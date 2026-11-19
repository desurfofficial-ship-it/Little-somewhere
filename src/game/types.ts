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
  | 'pond_driftwood';

export type PlayerLocation = 'exterior' | 'cottage_interior';

export type CottageInteractableId =
  | 'interior_door'
  | 'cottage_bed'
  | 'cottage_hearth'
  | 'cottage_table'
  | 'cottage_shelf'
  | 'cottage_desk'
  | 'cottage_planter';

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
  | 'chamomile_pear_tea'
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
  | 'cedar_music_box';

export type GiftReactionTier = 'loved' | 'liked' | 'neutral';

export interface PersonalItemDef {
  id: PersonalItemId;
  label: string;
  category: PersonalItemCategory;
  description: string;
  homeDisplayable?: 'vase' | 'shelf';
  giftable: boolean;
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
    | 'conflict_shift';
  actors: ResidentId[];
  summary: string;
  summaryTag: string;
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
}

export type DialogueCategory =
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
  kind: 'resident' | 'prop' | 'seat' | 'carryable' | 'cottage_prop';
  id: string;
  label: string;
  actionLabel: string;
  distance: number;
  worldPos: Vec2;
  seatId?: string;
  carryableId?: CarryableItemId;
  cottagePropId?: CottageInteractableId;
}
