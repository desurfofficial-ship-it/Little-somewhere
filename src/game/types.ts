export type GameScreenState = 'title' | 'playing' | 'paused';

export type TimePhase = 'morning' | 'afternoon' | 'golden' | 'dusk';

export type ResidentId =
  | 'clara'
  | 'arthur'
  | 'mina'
  | 'jun'
  | 'barnaby'
  | 'sora'
  | 'toby'
  | 'nora'
  | 'pip'
  | 'rowan';

export type PropInteractableId =
  | 'player_door'
  | 'player_mailbox'
  | 'gazebo_bell'
  | 'fountain_plaza'
  | 'hollow_oak'
  | 'plaza_noticeboard'
  | 'mirror_pond'
  | 'cottage_window_box'
  | 'greenhouse_planters'
  | 'orchard_harvest'
  | 'orchard_skep'
  | 'pond_driftwood'
  | 'greenhouse_door'
  | 'bakery_door'
  | 'nook_door'
  | 'copperwheel_door'
  | 'old_stone_well'
  | 'rise_vista'
  | 'marigold_bank'
  | 'wild_bee_log'
  | 'sorrel_garden_bed'
  // Stage 3 (Willow Jetty fishing) — quiet rod fishing on Mirror Pond's south shore.
  | 'willow_jetty'
  // Stage 3 v1.1 (West Brook) — second unhurried cast, at the culvert mouth on the
  // west lawn (FISHING_SPOTS registry in src/game/fishing.ts; one cast per day total).
  | 'west_brook_bank';

export type PlayerLocation =
  | 'exterior'
  | 'cottage_interior'
  | 'greenhouse_interior'
  | 'bakery_interior'
  | 'nook_interior'
  | 'copperwheel_interior';

export type CottageInteractableId =
  | 'interior_door'
  | 'cottage_bed'
  | 'cottage_hearth'
  | 'cottage_table'
  | 'cottage_shelf'
  | 'cottage_desk'
  | 'cottage_planter';

export type GreenhouseInteractableId =
  | 'greenhouse_door'
  | 'greenhouse_potting'
  | 'greenhouse_shelf'
  | 'greenhouse_water'
  | 'greenhouse_table';

export type GreenhouseCropId = 'chamomile' | 'lavender' | 'thyme' | 'foxglove';

export type GreenhouseGrowthStage = 0 | 1 | 2 | 3;

export interface GreenhousePlotState {
  /** Crop currently growing in this pot, or null for an empty pot. */
  cropId: GreenhouseCropId | null;
  /** In-game day the seeds were sown (0 when empty). */
  plantedDay: number;
  /** Watered in-game nights accumulated toward the next growth stage. */
  nightsGrown: number;
  /** 0 freshly sown · 1 sprout · 2 leafy · 3 ready to harvest. */
  stage: GreenhouseGrowthStage;
  /** True when watered at the rain barrel today (growth only advances on watered nights). */
  wateredToday: boolean;
  /** Consecutive watered nights of steady care while actively growing (GA-2; resets on harvest, missed nights, and winter rest). */
  waterStreak: number;
}

// Everyday Gameplay GA-1 — Community Projects contribution shelves (WorldState v12)
export interface CommunityProjectProgress {
  /** Item totals tucked into the contribution basket so far (only accepted item ids appear). */
  contributed: Partial<Record<PersonalItemId, number>>;
  /** In-game day the project was completed (0 = still open). */
  completedDay: number;
}

/** Per-project community shelf state, keyed by project id (unknown ids are dropped by the sanitizer). */
export type CommunityProjectsState = Record<string, CommunityProjectProgress>;

export interface GreenhouseState {
  plots: GreenhousePlotState[];
  /** In-game day Mina's planting notes were first read (0 = unread). */
  noteReadDay: number;
  totalHarvests: number;
  totalPlanted: number;
}

export type BakeryInteractableId =
  | 'bakery_door'
  | 'bakery_oven'
  | 'bakery_counter'
  | 'bakery_prep'
  | 'bakery_notes'
  | 'bakery_table';

export type BakeryBakeId = 'sunflower_sourdough' | 'crabapple_galette' | 'lavender_butter_batch' | 'oven_rest';

export type NookInteractableId =
  | 'nook_door'
  | 'nook_shelf'
  | 'nook_desk'
  | 'nook_tea'
  | 'nook_chair';

export type NookBookId = 'ivy_letters' | 'pond_sketches' | 'bread_hymns' | 'night_orchard';

export type CopperwheelInteractableId =
  | 'cw_door'
  | 'cw_bench'
  | 'cw_stove'
  | 'cw_shelf'
  | 'cw_bed'
  | 'cw_chair';

export type CopperwheelProjectId =
  | 'orchard_pendulum'
  | 'music_box_comb'
  | 'watch_escapement'
  | 'bench_rest';

/**
 * Copperwheel Cottage interior state (Milestone 3 Build 9, WorldState v10).
 * Day stamps hold the last in-game day each ritual was performed; 0 means never.
 */
export interface CopperwheelState {
  /** Last day the workbench's current project was examined. */
  benchCheckedDay: number;
  /** Last day Arthur's fine work was helped with at the bench. */
  helpedDay: number;
  /** Last day a chamomile cup was poured at the copper kettle. */
  teaSharedDay: number;
  /** Last day Arthur's mending ledger was read. */
  notesReadDay: number;
  /** In-game day the one-time starter tea came with the ledger notes (0 = not yet). */
  starterTeaDay: number;
  /** Lifetime count of distinct bench projects admired (max 4 in the project cycle). */
  projectsAdmired: number;
  /** Lifetime count of fine-work mornings helped. */
  windingSessions: number;
  /** Lifetime count of chamomile cups shared at Arthur's kettle. */
  teasShared: number;
}

/**
 * Linden Book Nook interior state (Milestone 3 Build 8, WorldState v9).
 * Day stamps hold the last in-game day each ritual was performed; 0 means never.
 */
export interface NookState {
  /** Last day the shelf's featured book was browsed. */
  shelfBrowsedDay: number;
  /** Last day a reader's cup was poured at the tea tray. */
  teaSharedDay: number;
  /** Last day Nora's lending notes were read. */
  notesReadDay: number;
  /** In-game day the one-time starter tea came with the notes (0 = not yet). */
  starterTeaDay: number;
  /** Lifetime count of distinct books settled into (max 4 in the shelf cycle). */
  booksRead: number;
  /** Lifetime count of reader's cups taken. */
  teasShared: number;
}

/**
 * Hearth & Crumb Bakery interior state (Milestone 3 Build 7, WorldState v8).
 * All `*Day` stamps hold the last in-game day the matching ritual was performed;
 * 0 means never. Day stamps compare against `world.day`, so nothing needs resetting
 * in `advanceToNextDay` — a new day simply differs from the stamp.
 */
export interface BakeryState {
  /** Last day the morning bake was checked at the oven. */
  bakeCheckedDay: number;
  /** Last day dough kneading was helped at the prep table. */
  kneadedDay: number;
  /** Last day a bake share was taken at the counter. */
  loafSharedDay: number;
  /** Last day Clara's recipe notes were read. */
  notesReadDay: number;
  /** In-game day the one-time starter loaf came with the recipe notes (0 = not yet). */
  starterNotesDay: number;
  /** Lifetime count of kneading mornings shared with Clara. */
  kneadingSessions: number;
  /** Lifetime count of bake shares taken home. */
  loavesShared: number;
}

export type PersonalItemCategory =
  | 'flora_ingredient'
  | 'baked_treat'
  | 'field_find'
  | 'keepsake';

export type PersonalItemId =
  | 'crabapple'
  | 'lemon_thyme'
  | 'chamomile_blossom'
  | 'lavender_sprig'
  | 'wild_honey'
  | 'chamomile_seeds'
  | 'lavender_seeds'
  | 'thyme_seeds'
  | 'chamomile_pear_tea'
  | 'lavender_chamomile_tea'
  | 'herb_loaf'
  | 'crabapple_tart'
  | 'lavender_shortbread'
  | 'smooth_river_glass'
  | 'heron_feather'
  | 'pressed_fern'
  | 'cedar_shaving_rose'
  | 'willow_zine_copy'
  | 'brass_pocket_bell'
  | 'pond_watercolor_card'
  | 'woven_herb_wreath'
  | 'cedar_music_box'
  | 'foxglove_seeds'
  | 'foxglove_bloom'
  | 'meadow_posy'
  // Stage 3 (Willow Jetty fishing) — pond catches, giftable field finds.
  | 'silver_dace'
  | 'sun_perch'
  | 'rain_trout'
  | 'mirror_carp'
  | 'ice_perch';

export type GiftReactionTier = 'loved' | 'liked' | 'neutral';

export interface PersonalItemDef {
  id: PersonalItemId;
  label: string;
  category: PersonalItemCategory;
  description: string;
  homeDisplayable?: 'vase' | 'shelf';
  giftable: boolean;
  /** True for brewed drinks that can be enjoyed with the seated tea-table ritual. */
  sipable?: boolean;
}

export interface RecipeDef {
  id: string;
  outputItemId: PersonalItemId;
  outputCount: number;
  label: string;
  description: string;
  minutesRequired: number;
  ingredients: Array<{ itemId: PersonalItemId; count: number }>;
}

export interface CottageHomeState {
  placedFlowerId: 'chamomile_blossom' | 'lavender_sprig' | 'crabapple' | null;
  displayedKeepsakeIds: PersonalItemId[];
  hearthLit: boolean;
  kettleWarmUntilMinute: number;
  almanacReadToday: boolean;
  cottageRestCount: number;
}

export interface DailyActivitiesState {
  cottagePlanterTendedToday: boolean;
  greenhousePlantersTendedToday: boolean;
  orchardHarvestedToday: boolean;
  pondCombedToday: boolean;
  bakedCountToday: number;
  giftedResidentsToday: ResidentId[];
}

export type CarryableItemId =
  | 'water_pail'
  | 'rosemary_basket'
  | 'chalk_bundle'
  | 'tea_tray'
  | 'lost_parcel';

export type CharacterEmotion =
  | 'happy'
  | 'sad'
  | 'excited'
  | 'tired'
  | 'frustrated'
  | 'angry'
  | 'relaxed'
  | 'embarrassed'
  | 'curious'
  | 'surprised';

export type CharacterTemperament =
  | 'gentle'
  | 'spirited'
  | 'contemplative'
  | 'industrious'
  | 'whimsical';

export type PlayerMovementMode = 'idle' | 'walk' | 'run' | 'sprint';

export type PlayerPosture = 'standing' | 'sitting';

export interface Vec2 {
  x: number;
  z: number;
}

export interface ScreenVec2 {
  x: number;
  y: number;
}

export interface ResidentAppearance {
  coatColor: string;
  shirtColor: string;
  hairColor: string;
  skinColor: string;
  accentColor: string;
  hatStyle: 'none' | 'beret' | 'cap' | 'straw' | 'hood' | 'bun';
  propType:
    | 'none'
    | 'satchel'
    | 'watering_can'
    | 'violin'
    | 'sketchbook'
    | 'book'
    | 'loaf'
    | 'fruit_basket';
  heightScale: number;
}

export interface ScheduleSlot {
  phase: TimePhase;
  target: Vec2;
  placeName: string;
  activity: string;
  facingAngle: number;
}

export interface ResidentTraits {
  sociability: number; // 0.0 (reserved) .. 1.0 (outgoing)
  outdoorsiness: number; // 0.0 .. 1.0
  morningLark: number; // 0.0 .. 1.0
  curiosity: number; // 0.0 .. 1.0
  preferredZones: string[];
  rainBehavior: 'shelter_home' | 'visit_cafe' | 'umbrella_stroll';
  temperament?: CharacterTemperament;
  greetingDistance?: number;
}

export interface ResidentDefinition {
  id: ResidentId;
  name: string;
  role: string;
  homeName: string;
  homePos?: Vec2;
  personality: string;
  favoriteThing: string;
  likedItems?: CarryableItemId[];
  traits: ResidentTraits;
  appearance: ResidentAppearance;
  schedule: Record<TimePhase, ScheduleSlot>;
}

export type ResidentMood = 'peaceful' | 'wistful' | 'busy' | 'warm' | 'joyful';

export interface ResidentProgress {
  trust: number; // 0 to 5
  met: boolean;
  talkedToday: boolean;
  mood: ResidentMood;
  lastDialogueId: string | null;
}

export interface StoryFlags {
  heardBellMystery: boolean;
  foundPostcard: boolean;
  deliveredPostcard: boolean;
  brewedChamomileTea: boolean;
  borrowedBarnabyLadder: boolean;
  clearedGazeboIvy: boolean;
  foundBrassClapper: boolean;
  repairedFountain: boolean;
  plantedMoonPetals: boolean;
  mediationStyle: 'none' | 'gentle_truth' | 'shared_baking' | 'festival_ring';
  bellRestored: boolean;
  claraArthurReconciled: boolean;
  lanternsLit: boolean;
}

export interface EnvironmentalState {
  plantersBloomed: number; // 0 to 3
  fountainFlowing: boolean;
  ivyCleared: boolean;
  bellGleaming: boolean;
  festoonLanterns: boolean;
  bakeryTablesOpen: boolean;
  reconciledTogether: boolean;
  noticeboardUpdated: boolean;
  orchardGatheringOutcome?: 'none' | 'spiced_tart_table' | 'blossom_honey_picnic';
}

export interface JournalMemory {
  id: string;
  day: number;
  phase: TimePhase;
  title: string;
  summary: string;
  residentId?: ResidentId;
}

export type SeasonType = 'spring' | 'summer' | 'autumn' | 'winter';

export type WeatherType = 'sunlit' | 'breezy' | 'misty_morning' | 'light_rain';

export type NpcAnimationState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'turn'
  | 'sit'
  | 'interact'
  | 'carry'
  | 'talk'
  | 'listen'
  | 'wave'
  | 'rest'
  | 'work'
  | 'sketch_read'
  | 'music'
  | 'converse'
  | 'admire';

export interface NpcNeeds {
  energy: number; // 0..100
  social: number; // 0..100
  hunger: number; // 0..100 (100 = well-fed)
  fulfillment: number; // 0..100
}

export interface NpcRuntimeState {
  position: Vec2;
  facing: number;
  animState: NpcAnimationState;
  walkPhase: number;
  currentActivityId: string;
  currentPlaceName: string;
  currentActivityLabel: string;
  targetPos: Vec2;
  targetFacing: number;
  waypoints: Vec2[];
  activityUntilMinute: number;
  stuckSeconds: number;
  socialPartnerId: ResidentId | null;
  socialCooldownUntilMinute: number;
  // Character Excellence & Living Autonomy additions
  emotion: CharacterEmotion;
  emotionIntensity: number; // 0..1
  emotionUntilMinute: number;
  needs: NpcNeeds;
  posture: PlayerPosture;
  reservedSeatId: string | null;
  goalUtility: number;
  goalCommittedUntilMinute: number;
  lastGreetedPlayerMinute: number;
  activeBubbleText: string | null;
  activeBubbleUntilMinute: number;
  targetLookPos: Vec2 | null;
  currentSpeed: number;
  // A1: activity ids recently found unreachable via stuck-recovery; suppressed
  // for a few re-selections so the resident picks a reachable alternative.
  blockedActivityIds?: string[];
  // QA-SIM D1 fix: seconds accumulated while moving freely — clears
  // blockedActivityIds after a short grace window so a transient obstruction
  // doesn't blacklist an activity for the rest of the day. Ephemeral (sanitizer
  // strips it; never persisted), but cloned by cloneNpcRuntime so the pure
  // stepSimulation path and the in-place path stay in lockstep (twin-determinism).
  unstuckSeconds?: number;
}

export type RelationshipTier =
  | 'stranger'
  | 'acquaintance'
  | 'friendly'
  | 'close'
  | 'kindred';

export type NpcRelationTier =
  | 'estranged'
  | 'guarded'
  | 'acquainted'
  | 'warm'
  | 'confidant';

export interface PlayerNpcRelation {
  residentId: ResidentId;
  affinity: number; // 0..100
  familiarity: number;
  dailyAffinityGained: number; // capped at 20/day for non-milestone chats
  talkedCount: number;
  lastTalkDay: number | null;
  lastTalkPhase: TimePhase | null;
  mood: ResidentMood;
  moodUntilMinute: number;
  reliability: number; // 0..100
  negativeCount: number;
  favorsCompleted: number;
  giftsGiven: number;
  lastEmotion: CharacterEmotion;
}

export type NpcPairKey = `${ResidentId}:${ResidentId}`;

export interface NpcNpcRelation {
  pair: NpcPairKey;
  affinity: number; // -50..100
  tension: number; // 0..100
  sharedTags: string[];
  lastInteractionDay: number | null;
  lastGossipDay?: number | null;
  lastGossipMinute?: number | null;
  lastGossipEventId?: string;
  // C3: a distinct "how well they know each other" axis from affinity.
  // Repeated autonomous encounters accumulate familiarity; confidant tier now
  // requires a familiarity threshold so a pair can't skip straight to intimacy.
  familiarity?: number;
  encounterCount?: number;
}

/**
 * S4 (directional perception overlay): A's subjective attitude toward B,
 * layered on the bilateral `NpcNpcRelation`. The bilateral record stays the
 * shared observable truth (what an outside observer would say); this overlay
 * holds A's individual perception — which may diverge from B's.
 *
 * Effective tier/affinity used by A's behavior = bilateral + A→B overlay.
 * Persisted as `world.npcPerceptions[A][B]`. Optional — old saves load with
 * empty overlays and behave exactly as today (zero divergence).
 */
export interface NpcPerception {
  perceiverId: ResidentId;
  targetId: ResidentId;
  /** Subjective affinity delta [-30..+30] applied atop bilateral.affinity. */
  affinityDelta: number;
  /** Subjective tension delta [-20..+20] applied atop bilateral.tension. */
  tensionDelta: number;
  /** Directional tags (cap 4) — what only A believes about B. */
  perceptionTags?: string[];
  /** Last day A's perception of B shifted (for atrophy). */
  lastShiftDay?: number | null;
}

/**
 * S6 (social groups): a named group of 3+ residents with a shared identity.
 * Derived friend-circles form from pairwise perceived-confidant closure;
 * authored shared-interest groups seed from baseline bonds.
 */
export type SocialGroupKind = 'friend_circle' | 'shared_interest' | 'regular_gathering';

export interface SocialGroupMembership {
  residentId: ResidentId;
  joinedDay: number;
  /** This resident's standing in the group [0..1]. */
  cohesion: number;
}

export interface SocialGroup {
  id: string;
  label: string;
  kind: SocialGroupKind;
  members: SocialGroupMembership[];
  anchorPlace?: string;
  anchorPhase?: TimePhase;
  authored: boolean;
  recognizedDay?: number;
}

export type NpcMemoryProvenance = 'firsthand' | 'secondhand' | 'rumor';

export type NpcMemorySourceKind =
  | 'participant'
  | 'witness'
  | 'player_told'
  | 'gossip';

export type NpcMemoryCategory =
  | 'event'
  | 'interaction'
  | 'friction'
  | 'social_impression'
  | 'town_lore';

export type NpcMemoryValence = 'warm' | 'neutral' | 'tense';

export type NpcMemoryRetention = 'permanent' | 'durable' | 'ephemeral';

export type NpcMemoryDistortionFlavor =
  | 'none'
  | 'uncertain'
  | 'exaggerated'
  | 'softened'
  | 'misattributed_motive';

export interface NpcMemoryDetail {
  itemId?: CarryableItemId;
  personalItemId?: PersonalItemId;
  placeName?: string;
  targetTier?: RelationshipTier;
  acousticOnly?: boolean;
  /** S1: the landmark zone id where the memory formed, for place-affinity bias. */
  placeZoneId?: string;
}

export interface NpcMemoryEntry {
  id: string;
  eventId: string;
  tag: string;
  category: NpcMemoryCategory;
  subjectPlayer: boolean;
  subjectResidents: ResidentId[];
  provenance: NpcMemoryProvenance;
  sourceKind: NpcMemorySourceKind;
  originResidentId?: ResidentId;
  fromResidentId?: ResidentId;
  hopCount: number;
  confidence: number; // 0..100
  distorted: boolean;
  distortionFlavor: NpcMemoryDistortionFlavor;
  createdDay: number;
  createdMinute: number;
  learnedDay: number;
  learnedMinute: number;
  expiresDay?: number;
  importance: number; // 1..5
  retention: NpcMemoryRetention;
  valence: NpcMemoryValence;
  emotionalWeight: number; // 0..100
  mentionedToPlayer: boolean;
  sharedCount: number;
  detail?: NpcMemoryDetail;
}

export interface WorldEventRecord {
  id: string;
  day: number;
  phase: TimePhase;
  minuteOfDay: number;
  kind:
    | 'story_flag'
    | 'npc_social'
    | 'bell_ring'
    | 'weather_shift'
    | 'player_help'
    | 'storyline_beat'
    | 'conflict_shift'
    | 'shared_activity';
  actors: ResidentId[];
  summary: string;
  summaryTag: string;
}

export type InvitationStatus = 'offered' | 'accepted';

export type InvitationOutcome = 'completed' | 'declined' | 'expired';

export interface InvitationRecord {
  id: string;
  status: InvitationStatus;
  hostId: ResidentId;
  activityId: string;
  offeredDay: number;
  expiresDay: number;
  windowStartMinute: number;
  windowEndMinute: number;
}

export interface InvitationHistoryEntry {
  invitationId: string;
  hostId: ResidentId;
  activityId: string;
  day: number;
  outcome: InvitationOutcome;
  reason?: string;
}

export interface InvitationState {
  active: InvitationRecord | null;
  history: InvitationHistoryEntry[];
  lastOfferDayByHost: Partial<Record<ResidentId, number>>;
}

export type InteriorLocation = Exclude<PlayerLocation, 'exterior'>;

export interface InteriorOccupant {
  residentId: ResidentId;
  location: InteriorLocation;
  stationId: string;
  localPos: Vec2;
  facing: number;
  invitationId: string;
}

export interface TeachingState {
  known: string[];
}

export interface ActiveSharedActivity {
  activityId: string;
  invitationId: string;
}

export interface ResidentActivityEntry {
  day: number;
  minuteOfDay: number;
  activityId: string;
  placeName: string;
  label: string;
}

export interface ActiveSocialEncounter {
  id: string;
  participants: ResidentId[];
  topicTag: string;
  summary: string;
  spots: Vec2[];
  startedMinute: number;
  endsMinute: number;
}

export interface TopicHistoryEntry {
  seenCount: number;
  lastSeenDay: number;
  lastSeenPhase: TimePhase;
  chosenChoiceIds: string[];
}

export interface WorldPropPlacement {
  id: CarryableItemId;
  label: string;
  description: string;
  pos: Vec2;
  homePos: Vec2;
  holder: 'world' | 'player' | ResidentId;
  likedBy: ResidentId[];
}

export interface SeatSpot {
  id: string;
  label: string;
  seatPos: Vec2;
  approachPos: Vec2;
  facingAngle: number;
  seatHeight: number;
  zoneId: string;
  /** True for cottage-interior seats (walkability validated with the indoor grid, never NPC-claimed). */
  indoor?: boolean;
}

export type StorylineStatus = 'locked' | 'available' | 'active' | 'completed';

export interface StorylineProgress {
  id: string;
  stage: number;
  status: StorylineStatus;
  outcome?: string;
  startedDay?: number;
  updatedDay?: number;
  completedDay?: number;
  cooldownUntilDay?: number;
  notes?: string[];
}

export interface StorylineStageDef {
  stage: number;
  title: string;
  journalHint: string;
  involvedResidents: ResidentId[];
  unlockCondition?: DialogueCondition;
}

export interface StorylineOutcomeDef {
  label: string;
  journalSummary: string;
}

export interface StorylineDefinition {
  id: string;
  title: string;
  subtitle: string;
  category: 'personal_story' | 'interconnected_conflict';
  leadResidents: ResidentId[];
  stages: StorylineStageDef[];
  outcomes: Record<string, StorylineOutcomeDef>;
}

export interface StorylineAdvanceSpec {
  id: string;
  setStage?: number;
  setStatus?: StorylineStatus;
  setOutcome?: string;
  cooldownDays?: number;
  note?: string;
}

export interface NpcRelationAdjustment {
  a: ResidentId;
  b: ResidentId;
  deltaAffinity: number;
  deltaTension: number;
  tag?: string;
}

export interface WorldState {
  schemaVersion: number;
  // Milestone 3 Build 6 — Sunbeam Greenhouse shared growing corner (WorldState v7)
  greenhouseState: GreenhouseState;
  // Milestone 3 Build 7 — Hearth & Crumb Bakery visitable interior (WorldState v8)
  bakeryState: BakeryState;
  // Milestone 3 Build 8 — Linden Book Nook visitable interior (WorldState v9)
  nookState: NookState;
  // Milestone 3 Build 9 — Copperwheel Cottage visitable interior (WorldState v10)
  copperwheelState: CopperwheelState;
  simSeed: number;
  regionId: string;
  day: number;
  minuteOfDay: number; // 360 (6:00 AM) to 1290 (9:30 PM)
  season: SeasonType;
  weather: WeatherType;
  playerPos: Vec2;
  playerFacing: number;
  playerPosture: PlayerPosture;
  playerSeatId: string | null;
  playerHeldItem: CarryableItemId | null;
  worldProps: Record<CarryableItemId, WorldPropPlacement>;
  residents: Record<ResidentId, ResidentProgress>;
  npcRuntime: Record<ResidentId, NpcRuntimeState>;
  playerRelations: Record<ResidentId, PlayerNpcRelation>;
  npcRelations: Record<string, NpcNpcRelation>;
  activeEncounters: ActiveSocialEncounter[];
  worldEvents: WorldEventRecord[];
  npcActivityHistory: Record<ResidentId, ResidentActivityEntry[]>;
  topicHistory: Record<string, TopicHistoryEntry>;
  lastTopicByResident: Partial<Record<ResidentId, string>>;
  sideFlags: Record<string, boolean | number | string>;
  flags: StoryFlags;
  memories: JournalMemory[];
  npcMemories: Record<ResidentId, NpcMemoryEntry[]>;
  storylines: Record<string, StorylineProgress>;
  mailboxUnread: boolean;
  dailyLettersRead: number[];
  bellRungCount: number;
  // Milestone 2C — Everyday Life (WorldState v6)
  playerLocation: PlayerLocation;
  exteriorPlayerPos: Vec2;
  exteriorPlayerFacing: number;
  inventory: Partial<Record<PersonalItemId, number>>;
  discoveredItemIds: PersonalItemId[];
  cottageState: CottageHomeState;
  dailyActivities: DailyActivitiesState;
  neighborGiftsReceived: ResidentId[];
  // Living Relationships (LR-1 / LR-2 — WorldState v11)
  invitations: InvitationState;
  occupancy: InteriorOccupant | null;
  teaching: TeachingState;
  activeActivity: ActiveSharedActivity | null;
  // Everyday Gameplay GA-1 — Community Projects (WorldState v12)
  communityProjects: CommunityProjectsState;
  // NPC Intelligence Evolution — directional perception overlay (S4) and
  // emergent social groups (S6). Optional; old saves load with empty overlays
  // and behave exactly as today (schema stays v12 — no migration required).
  npcPerceptions?: Partial<Record<ResidentId, Partial<Record<ResidentId, NpcPerception>>>>;
  npcSocialGroups?: SocialGroup[];
}

export type DialogueCategory =
  | 'invitation'
  | 'quest_milestone'
  | 'personal_story'
  | 'conflict_reconciliation'
  | 'event_reaction'
  | 'npc_gossip'
  | 'relationship_tier'
  | 'emotion_reaction'
  | 'weather_season'
  | 'daily_slice';

export interface DialogueStorylineCondition {
  id: string;
  status?: StorylineStatus[];
  minStage?: number;
  maxStage?: number;
  outcome?: string;
  requireCooldownCleared?: boolean;
}

export interface ThirdPartyRelationCondition {
  residentId: ResidentId;
  minTier?: RelationshipTier;
  maxTier?: RelationshipTier;
  minAffinity?: number;
  maxAffinity?: number;
  requiresMet?: boolean;
  requiresGuarded?: boolean;
}

export interface DialogueCondition {
  flagsTrue?: Array<keyof StoryFlags>;
  flagsFalse?: Array<keyof StoryFlags>;
  sideFlagsTrue?: string[];
  sideFlagsFalse?: string[];
  minTrust?: number;
  maxTrust?: number;
  minAffinity?: number;
  minTier?: RelationshipTier;
  maxTier?: RelationshipTier;
  minReliability?: number;
  playerRelationWith?: ThirdPartyRelationCondition;
  requiresThirdPartyGossip?: boolean;
  minNpcAffinity?: { a: ResidentId; b: ResidentId; min: number };
  maxNpcAffinity?: { a: ResidentId; b: ResidentId; max: number };
  minNpcTension?: { a: ResidentId; b: ResidentId; min: number };
  emotions?: CharacterEmotion[];
  excludeEmotions?: CharacterEmotion[];
  phases?: TimePhase[];
  weathers?: WeatherType[];
  requiresWeatherNot?: WeatherType[];
  seasons?: SeasonType[];
  requiresPosture?: PlayerPosture[];
  requiresTraits?: {
    minSociability?: number;
    minOutdoorsiness?: number;
    minMorningLark?: number;
    minCuriosity?: number;
    rainBehavior?: ResidentTraits['rainBehavior'];
  };
  requiresRecentEventKind?: { kind: WorldEventRecord['kind']; maxDaysAgo: number };
  requiresRecentEventTag?: { tagPrefix: string; maxDaysAgo: number };
  /**
   * Social Foundation SF-4: the knowledge-scoped sibling of
   * `requiresRecentEventKind/Tag`. Requires a recent world event the SPEAKER
   * experienced (actor match) AND holds a subjective memory for. Use this —
   * not the global-scan predicates — for any content where a resident reacts
   * to something that happened in the world.
   */
  requiresWitnessedEvent?: {
    kinds?: WorldEventRecord['kind'][];
    tagPrefix?: string;
    maxDaysAgo: number;
  };
  requiresNpcMemoriesAny?: string[];
  excludesNpcMemories?: string[];
  requiresNpcMemory?: {
    tag?: string;
    tags?: string[];
    id?: string;
    provenance?: NpcMemoryProvenance[];
    maxDaysOld?: number;
    unmentionedOnly?: boolean;
    subjectPlayer?: boolean;
    subjectResidentId?: ResidentId;
  };
  requiresStoryline?: DialogueStorylineCondition;
  requiresInvitationEligible?: { hostId?: ResidentId; activityId: string };
  requiresActiveInvitation?: {
    hostId?: ResidentId;
    activityId?: string;
    status?: InvitationStatus | InvitationStatus[];
    requireLive?: boolean;
    requireIndoors?: boolean;
  };
  excludesActiveInvitation?: boolean;
  requiresTeachingKnown?: string[];
  notSeenToday?: boolean;
  minDaysSinceSeen?: number;
  maxSeenCount?: number;
  requiresMet?: boolean;
  talkedCountMin?: number;
}

export interface DialogueChoice {
  id: string;
  label: string;
  tone?: 'warm' | 'curious' | 'gentle' | 'practical' | 'blunt';
  nextNodeId: string;
  trustDelta?: number;
  reliabilityDelta?: number;
  isStoryMilestone?: boolean;
  isNegative?: boolean;
  setEmotion?: CharacterEmotion;
  setFlags?: Partial<StoryFlags>;
  setSideFlags?: Record<string, boolean | number | string>;
  adjustNpcTension?: NpcRelationAdjustment;
  adjustNpcRelations?: NpcRelationAdjustment[];
  advanceStoryline?: StorylineAdvanceSpec | StorylineAdvanceSpec[];
  deliverHeldItem?: CarryableItemId;
  grantPersonalItem?: { itemId: PersonalItemId; count?: number };
  unlockMemory?: Omit<JournalMemory, 'day' | 'phase'>;
  offerInvitation?: { hostId?: ResidentId; activityId: string };
  acceptInvitation?: boolean;
  declineInvitation?: boolean;
  completeSharedActivityId?: string;
  requiresFlag?: keyof StoryFlags;
  requiresFalseFlag?: keyof StoryFlags;
  requiresSideFlag?: string;
  requiresFalseSideFlag?: string;
  minTrust?: number;
  minAffinity?: number;
  minTier?: RelationshipTier;
  requiresCondition?: DialogueCondition;
  recordNpcMemories?: Array<{
    target: 'speaker' | ResidentId;
    id: string;
    eventId?: string;
    tag: string;
    category: NpcMemoryCategory;
    valence: NpcMemoryValence;
    importance: number;
    retention: NpcMemoryRetention;
    sourceKind?: NpcMemorySourceKind;
    subjectPlayer?: boolean;
    subjectResidents?: ResidentId[];
    emotionalWeight?: number;
  }>;
  markMemoryTagsMentioned?: string[];
  markMemoryEventIdsMentioned?: string[];
}

export interface DialogueNode {
  id: string;
  speakerName: string;
  speakerRole: string;
  moodLabel: string;
  text: string;
  choices: DialogueChoice[];
  isEnd?: boolean;
  /**
   * Optional speaker-visual override, resolved by `dialogue/assets.ts` into a
   * procedural portrait descriptor. When absent, the session resident's default
   * portrait applies (older saves/nodes keep full backward compatibility).
   */
  portraitKey?: string;
  /**
   * Optional object/environment illustration key for prop-inspection nodes,
   * resolved by `dialogue/assets.ts`. When absent the speaker visual slot
   * simply shows the portrait/default treatment.
   */
  subjectImageKey?: string;
}

export interface DialogueTopic {
  id: string;
  residentId: ResidentId | 'any';
  category: DialogueCategory;
  priority?: number;
  historyScope?: 'resident' | 'global';
  condition?: DialogueCondition;
  build: (
    residentId: ResidentId,
    world: WorldState,
    phase: TimePhase,
  ) => {
    rootId: string;
    nodes: Record<string, DialogueNode>;
  };
}

export interface DialogueSession {
  residentId: ResidentId;
  topicId?: string;
  topicHistoryKey?: string;
  category?: DialogueCategory;
  emotion?: CharacterEmotion;
  tier?: RelationshipTier;
  currentNodeId: string;
  nodes: Record<string, DialogueNode>;
  recentToast?: string;
  milestonePulseSeq?: number;
  milestoneLabel?: string;
  surfacedMemoryEventIds?: Array<{ residentId: ResidentId; eventId: string }>;
}

export interface InteractiveTarget {
  kind:
    | 'resident'
    | 'prop'
    | 'seat'
    | 'carryable'
    | 'cottage_prop'
    | 'greenhouse_prop'
    | 'bakery_prop'
    | 'nook_prop'
    | 'copperwheel_prop';
  id: string;
  label: string;
  actionLabel: string;
  distance: number;
  worldPos: Vec2;
  seatId?: string;
  carryableId?: CarryableItemId;
  cottagePropId?: CottageInteractableId;
  greenhousePropId?: GreenhouseInteractableId;
  bakeryPropId?: BakeryInteractableId;
  nookPropId?: NookInteractableId;
  copperwheelPropId?: CopperwheelInteractableId;
  /** Set on seated cottage-seat targets when a sipable drink is in the satchel: primary action becomes the sip ritual. */
  sipItemId?: PersonalItemId;
}
