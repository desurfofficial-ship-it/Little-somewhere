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

export interface ResidentDefinition {
  id: ResidentId;
  name: string;
  role: string;
  homeName: string;
  personality: string;
  favoriteThing: string;
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

export interface WorldState {
  day: number;
  minuteOfDay: number; // 360 (6:00 AM) to 1260 (9:00 PM)
  playerPos: Vec2;
  playerFacing: number;
  residents: Record<ResidentId, ResidentProgress>;
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
