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
  | 'pip';

export type PropInteractableId =
  | 'player_door'
  | 'player_mailbox'
  | 'gazebo_bell'
  | 'fountain_plaza'
  | 'hollow_oak'
  | 'plaza_noticeboard';

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
  propType: 'none' | 'satchel' | 'watering_can' | 'violin' | 'sketchbook' | 'book' | 'loaf';
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
}

export interface ResidentDefinition {
  id: ResidentId;
  name: string;
  role: string;
  homeName: string;
  personality: string;
  favoriteThing: string;
  traits: ResidentTraits;
  appearance: ResidentAppearance;
  schedule: Record<TimePhase, ScheduleSlot>;
}

export interface ResidentProgress {
  trust: number; // 0 to 5
  met: boolean;
  talkedToday: boolean;
  mood: 'peaceful' | 'wistful' | 'busy' | 'warm' | 'joyful';
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
  | 'work'
  | 'sketch_read'
  | 'music'
  | 'converse'
  | 'admire';

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
}

export type RelationshipTier =
  | 'stranger'
  | 'acquaintance'
  | 'friendly'
  | 'close'
  | 'kindred';

export interface PlayerNpcRelation {
  residentId: ResidentId;
  affinity: number; // 0..100
  familiarity: number;
  dailyAffinityGained: number; // capped at 20/day for non-milestone chats
  talkedCount: number;
  lastTalkDay: number | null;
  lastTalkPhase: TimePhase | null;
  mood: ResidentProgress['mood'];
  moodUntilMinute: number;
}

export type NpcPairKey = `${ResidentId}:${ResidentId}`;

export interface NpcNpcRelation {
  pair: NpcPairKey;
  affinity: number; // -50..100
  tension: number; // 0..100
  sharedTags: string[];
  lastInteractionDay: number | null;
}

export interface WorldEventRecord {
  id: string;
  day: number;
  phase: TimePhase;
  minuteOfDay: number;
  kind: 'story_flag' | 'npc_social' | 'bell_ring' | 'weather_shift' | 'player_help';
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
  participants: [ResidentId, ResidentId];
  topicTag: string;
  summary: string;
  spots: [Vec2, Vec2];
  startedMinute: number;
  endsMinute: number;
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
  residents: Record<ResidentId, ResidentProgress>;
  npcRuntime: Record<ResidentId, NpcRuntimeState>;
  playerRelations: Record<ResidentId, PlayerNpcRelation>;
  npcRelations: Record<string, NpcNpcRelation>;
  activeEncounters: ActiveSocialEncounter[];
  worldEvents: WorldEventRecord[];
  npcActivityHistory: Record<ResidentId, ResidentActivityEntry[]>;
  flags: StoryFlags;
  memories: JournalMemory[];
  mailboxUnread: boolean;
  dailyLettersRead: number[];
  bellRungCount: number;
}

export interface DialogueChoice {
  id: string;
  label: string;
  tone?: 'warm' | 'curious' | 'gentle' | 'practical';
  nextNodeId: string;
  trustDelta?: number;
  isStoryMilestone?: boolean;
  setFlags?: Partial<StoryFlags>;
  unlockMemory?: Omit<JournalMemory, 'day' | 'phase'>;
  requiresFlag?: keyof StoryFlags;
  requiresFalseFlag?: keyof StoryFlags;
  minTrust?: number;
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

export interface DialogueSession {
  residentId: ResidentId;
  currentNodeId: string;
  nodes: Record<string, DialogueNode>;
  recentToast?: string;
}

export interface InteractiveTarget {
  kind: 'resident' | 'prop';
  id: string;
  label: string;
  actionLabel: string;
  distance: number;
  worldPos: Vec2;
}
