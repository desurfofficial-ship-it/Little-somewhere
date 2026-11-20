import {
  composeEnvironmentState,
  getWeatherLabel,
} from './environment';
import {
  getEmotionLabel,
  getHeartLevel,
  getRelationshipTier,
  getRelationshipTierLabel,
  moodToEmotion,
} from './relationships';
import {
  RESIDENTS,
  RESIDENT_ORDER,
  getResidentScheduleSlot,
  getTimePhase,
} from './residents';
import { getResidentAvailableQuestCue } from './narrative';
import { PERSONAL_ITEMS, PERSONAL_ITEM_MAP } from './inventory';
import { describePlacedFlower } from './cottage';
import { createInitialGreenhouseState, summarizeGreenhousePlots } from './greenhouse';
import { createInitialBakeryState, getBakeForDay } from './bakery';
import { createInitialNookState, getFeaturedBookForDay } from './bookNook';
import { createInitialCopperwheelState, getProjectForDay } from './copperwheel';
import {
  STORYLINES,
  getActiveStorylineCue,
  getStorylineProgress,
  isStorylineOnCooldown,
  projectStorylineForJournal,
} from './storylines';
import {
  EnvironmentalState,
  JournalMemory,
  NpcMemoryEntry,
  RelationshipTier,
  ResidentId,
  StorylineStatus,
  TimePhase,
  WorldEventRecord,
  WorldState,
} from './types';

export const JOURNAL_READ_STORAGE_KEY = 'little_somewhere_journal_read_v1';

export type JournalTabId = 'stories' | 'memories' | 'people' | 'discoveries';

export interface JournalMemoryItem {
  id: string;
  entryKey: string;
  title: string;
  summary: string;
  day: number;
  phase: TimePhase;
  phaseLabel: string;
  residentId?: ResidentId;
  residentName?: string;
  isLegacySide: boolean;
  isNew: boolean;
}

export interface JournalMainStoryStep {
  id: string;
  entryKey: string;
  title: string;
  status: 'ongoing' | 'completed';
  detailText: string;
  isNew: boolean;
}

export interface JournalStorylineCard {
  id: string;
  entryKey: string;
  title: string;
  subtitle: string;
  category: 'personal_story' | 'interconnected_conflict';
  status: Extract<StorylineStatus, 'active' | 'completed'>;
  stage: number;
  totalStages: number;
  stageTitle: string;
  detailText: string;
  outcomeLabel?: string;
  involvedNames: string[];
  cooldownText?: string;
  notes: string[];
  startedDay?: number;
  completedDay?: number;
  isNew: boolean;
}

export interface JournalNpcNote {
  entryKey: string;
  eventId: string;
  text: string;
  certaintyKind: 'direct' | 'secondhand' | 'rumor';
  certaintyLabel: string;
  learnedDay: number;
  valence: NpcMemoryEntry['valence'];
  isNew: boolean;
}

export interface JournalPersonCard {
  id: ResidentId;
  entryKey: string;
  name: string;
  coatColor: string;
  met: boolean;
  roleLabel: string;
  placeLabel: string;
  personality?: string;
  trust: number;
  tier?: RelationshipTier;
  tierLabel?: string;
  emotionLabel?: string;
  reliabilityLabel?: string;
  cueKind: 'story' | 'ready' | 'none';
  cueTitle?: string;
  knownNotes: JournalNpcNote[];
  discoveredConnections: string[];
  isNew: boolean;
}

export interface JournalDiscoveryLandmark {
  id: string;
  entryKey: string;
  name: string;
  statusKind: 'transformed' | 'active' | 'quiet';
  statusLabel: string;
  summary: string;
  isNew: boolean;
}

export interface JournalLaneMoment {
  id: string;
  entryKey: string;
  day: number;
  phaseLabel: string;
  summary: string;
  isNew: boolean;
}

export interface JournalHomeSummary {
  placedFlowerLabel: string | null;
  vaseDescription: string;
  displayedKeepsakeLabels: string[];
  discoveredCount: number;
  totalItemCatalogCount: number;
  cottageRestCount: number;
  almanacReadToday: boolean;
  /** Pass 11: count of first-time tea-table ritual memories (`mem_teatable_*`). */
  homeRitualCount: number;
}

export interface PocketJournalView {
  day: number;
  phase: TimePhase;
  phaseLabel: string;
  seasonLabel: string;
  dayOfSeason: number;
  year: number;
  weatherLabel: string;
  tomorrowForecastLabel: string;
  memories: JournalMemoryItem[];
  mainStoryTitle: string;
  mainStorySteps: JournalMainStoryStep[];
  activeStorylines: JournalStorylineCard[];
  completedStorylines: JournalStorylineCard[];
  people: JournalPersonCard[];
  landmarks: JournalDiscoveryLandmark[];
  laneMoments: JournalLaneMoment[];
  homeSummary: JournalHomeSummary;
  noticeboardFlyerCount: number;
  greenhouseStage: number;
  plantersBloomed: number;
  newCounts: Record<JournalTabId, number>;
  tabEntryKeys: Record<JournalTabId, string[]>;
}

export function loadJournalReadKeys(): Set<string> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return new Set<string>();
    }
    const raw = window.localStorage.getItem(JOURNAL_READ_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set<string>();
  }
}

export function saveJournalReadKeys(keys: ReadonlySet<string>): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const bounded = Array.from(keys).slice(-240);
    window.localStorage.setItem(JOURNAL_READ_STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    // Ignore storage write failures in private mode or quota-limited environments
  }
}

export function formatTimePhaseLabel(phase: TimePhase): string {
  switch (phase) {
    case 'morning':
      return 'Morning';
    case 'afternoon':
      return 'Afternoon';
    case 'golden':
      return 'Golden Hour';
    case 'dusk':
      return 'Lantern Dusk';
  }
}

export function getReliabilityLabel(reliability: number): string {
  if (reliability >= 75) return 'Deeply trusted';
  if (reliability >= 50) return 'Steady friend';
  if (reliability >= 25) return 'Warming up';
  if (reliability >= 15) return 'Still cautious';
  return 'Guarded lately';
}

/**
 * Enforces the player-knowledge boundary on subjective NPC memories.
 * Never exposes unmentioned NPC-to-NPC gossip, unmentioned witness observations,
 * or private NPC memories that the player did not directly participate in or hear.
 */
export function isNpcMemoryKnownToPlayer(entry: NpcMemoryEntry): boolean {
  if (entry.mentionedToPlayer) return true;
  if (entry.sourceKind === 'player_told') return true;
  if (entry.sourceKind === 'participant' && entry.subjectPlayer) return true;
  return false;
}

function formatSubjectList(
  speakerId: ResidentId,
  subjectResidents: ResidentId[],
): string {
  const others = subjectResidents
    .filter((id) => id !== speakerId && Boolean(RESIDENTS[id]))
    .map((id) => RESIDENTS[id].name);
  if (others.length === 0) return '';
  if (others.length === 1) return others[0];
  if (others.length === 2) return `${others[0]} and ${others[1]}`;
  return `${others.slice(0, -1).join(', ')}, and ${others[others.length - 1]}`;
}

function describeNpcMemoryTopic(
  residentId: ResidentId,
  entry: NpcMemoryEntry,
): string {
  const selfName = RESIDENTS[residentId]?.name ?? residentId;
  const personalItemLabel = entry.detail?.personalItemId
    ? PERSONAL_ITEM_MAP[entry.detail.personalItemId]?.label
    : undefined;
  const itemText =
    personalItemLabel ??
    (entry.detail?.itemId ? entry.detail.itemId.replace(/_/g, ' ') : 'a keepsake');
  const placeText = entry.detail?.placeName ?? 'the neighborhood';
  const others = formatSubjectList(residentId, entry.subjectResidents);
  const targetTierLabel = entry.detail?.targetTier
    ? getRelationshipTierLabel(entry.detail.targetTier)
    : undefined;

  switch (entry.tag) {
    case 'player_gift':
      return entry.provenance === 'firsthand'
        ? `You carried ${itemText} over to ${selfName} near ${placeText}.`
        : `you carried ${itemText} over to ${others || selfName}`;
    case 'player_help_observed':
      return `you dropped off ${itemText}${others ? ` for ${others}` : ''} near ${placeText}`;
    case 'player_blunt':
      return entry.provenance === 'firsthand'
        ? `An earlier remark felt too blunt near ${placeText}.`
        : `a tense exchange happened near ${placeText}`;
    case 'player_blunt_observed':
      return `there was a blunt moment${others ? ` involving ${others}` : ''} near ${placeText}`;
    case 'player_amends':
      return entry.provenance === 'firsthand'
        ? `You apologized sincerely and cleared the air.`
        : `you cleared the air after an earlier misunderstanding`;
    case 'player_bond_friendly':
    case 'player_bond_close':
    case 'player_bond_kindred':
      if (entry.provenance === 'firsthand') {
        return `Your friendship grew into ${targetTierLabel ?? 'a warmer bond'}.`;
      }
      return `${others || selfName} spoke warmly of becoming ${targetTierLabel?.toLowerCase() ?? 'good friends'} with you`;
    case 'bell_mystery':
      return entry.provenance === 'firsthand'
        ? `Shared the story of the silent gazebo bell.`
        : `folks were piecing together why the gazebo bell fell silent`;
    case 'gazebo_ivy':
      return `the creeping ivy was cleared from the gazebo rafters`;
    case 'fountain_fixed':
      return `the old plaza stone fountain is pouring clear water again`;
    case 'moon_petals':
      return `moon-petal blooms opened along the cottage planters`;
    case 'postcard_delivered':
      return `Nora’s coastal postcard finally reached home`;
    case 'chamomile_tea':
      return `Sora brewed calming chamomile-pear tea for the lane`;
    case 'brass_clapper':
      return `the gazebo bell’s missing brass clapper turned up`;
    case 'bell_restored':
      return `the Old Bell Gazebo was restored over the square`;
    case 'bell_ring':
      return `the restored brass bell rang out over the square`;
    case 'bell_chime':
      return `the restored gazebo bell echoed softly across the rooftops`;
    case 'fountain_wish':
      return `a lucky copper coin chimed into the stone fountain`;
    case 'pond_skip':
      return `a flat river pebble skipped across Mirror Pond`;
    case 'gazebo_rift':
      return `an old disagreement lingered between Clara and Arthur over the gazebo`;
    case 'clara_arthur_reconciled':
      return `Clara and Arthur set old pride aside beside the restored gazebo`;
    case 'zine_draft_started':
      return `Pip started gathering chalk tales for Willow Lane Zine Issue #1`;
    case 'zine_contributor_art':
      return `Toby lent pond-and-lantern watercolors for the zine`;
    case 'zine_contributor_recipe':
      return `Clara offered rosemary crust notes for the zine`;
    case 'zine_published':
      return `Pip and Nora stitched Issue #1 of Willow Lane Zine`;
    case 'herb_harvest':
      return `Mina clipped fresh lemon-thyme for Clara’s stone oven`;
    case 'loaf_pairing_plaza':
      return `Sora suggested sharing lemon-thyme loaves at the plaza benches`;
    case 'loaf_pairing_basket':
      return `Sora paired chamomile-pear tea with Clara’s herb loaf for the greenhouse`;
    case 'herb_loaf_shared':
      return `warm lemon-thyme sourdough loaves made the rounds on the lane`;
    case 'pond_stand_requested':
      return `Sora needed a steady music stand beside Mirror Pond`;
    case 'pond_stand_wind_sketch':
      return `Toby sketched the pond gusts to help brace Sora’s music stand`;
    case 'pond_stand_clef_sketch':
      return `Toby sketched a treble clef carving for Sora’s music stand`;
    case 'pond_stand_built':
      return `Barnaby finished a cedar music stand for Sora’s afternoon violin etudes`;
    case 'watch_drift_shared':
      return `Jun worried about his drifting brass pocket watch`;
    case 'watch_ledger_trimmed':
      return `Nora trimmed extra stops from Jun’s morning mail ledger`;
    case 'watch_patient_pace':
      return `Nora reassured Jun to take his morning mail route calmly`;
    case 'watch_tuned':
      return `Arthur oiled and balanced Jun’s brass pocket watch`;
    case 'lantern_debate':
    case 'lantern_debate_blunt':
      return `neighbors weighed Barnaby’s pier lamps against Mirror Pond’s firefly dusk`;
    case 'lantern_trial_compromise':
    case 'lantern_trial_space':
    case 'lantern_trial_heated':
      return `Barnaby tested how evening lanterns felt along Mirror Pond`;
    case 'lanterns_resolved_compromise':
    case 'lanterns_resolved_space':
    case 'lanterns_resolved_harmony':
      return `neighbors settled how lanterns and dusk fireflies share Mirror Pond`;
    case 'orchard_gathering_started':
      return `Rowan began planning an orchard tasting table beneath the crabapple boughs`;
    case 'orchard_tart_planned':
      return `Clara pledged spiced Fern Hollow crabapple tarts for the orchard tasting table`;
    case 'orchard_picnic_planned':
      return `Mina prepared chamomile and wild skep honey for the orchard picnic`;
    case 'orchard_gathering_hosted':
      return `Rowan, Clara, and Mina hung marigold lanterns over the Fern Hollow tasting table`;
    default:
      return entry.tag.replace(/_/g, ' ');
  }
}

export function formatNpcMemoryForPlayer(
  residentId: ResidentId,
  entry: NpcMemoryEntry,
  seenKeys: ReadonlySet<string>,
): JournalNpcNote {
  const fromName = entry.fromResidentId ? RESIDENTS[entry.fromResidentId]?.name : undefined;
  const topicPhrase = describeNpcMemoryTopic(residentId, entry);
  const entryKey = `npc_${residentId}_${entry.eventId}_${entry.provenance}`;
  const isNew = !seenKeys.has(entryKey);

  // Rumors & distorted memories MUST preserve uncertainty and never appear as confirmed fact
  if (entry.provenance === 'rumor' || entry.distorted) {
    const sourceClause = fromName ? ` via ${fromName}` : '';
    let uncertaintySuffix = '';
    if (entry.distortionFlavor === 'uncertain') {
      uncertaintySuffix = ' (details sounded hazy)';
    } else if (entry.distortionFlavor === 'exaggerated') {
      uncertaintySuffix = ' (story may be overstated)';
    } else if (entry.distortionFlavor === 'misattributed_motive') {
      uncertaintySuffix = ' (intentions sounded tangled in retelling)';
    } else if (entry.distortionFlavor === 'softened') {
      uncertaintySuffix = ' (passed along gently, details unverified)';
    }

    const normalizedPhrase =
      topicPhrase.endsWith('.') ? topicPhrase.slice(0, -1) : topicPhrase;
    const lowerLead =
      normalizedPhrase.charAt(0).toLowerCase() + normalizedPhrase.slice(1);

    return {
      entryKey,
      eventId: entry.eventId,
      text: `Word going around${sourceClause} suggests ${lowerLead}${uncertaintySuffix}.`,
      certaintyKind: 'rumor',
      certaintyLabel: 'Unconfirmed rumor',
      learnedDay: entry.learnedDay,
      valence: entry.valence,
      isNew,
    };
  }

  if (entry.provenance === 'secondhand') {
    const sourceClause = fromName ? ` from ${fromName}` : ' along the lane';
    const normalizedPhrase =
      topicPhrase.endsWith('.') ? topicPhrase.slice(0, -1) : topicPhrase;
    const lowerLead =
      normalizedPhrase.charAt(0).toLowerCase() + normalizedPhrase.slice(1);

    return {
      entryKey,
      eventId: entry.eventId,
      text: `Heard${sourceClause} that ${lowerLead}.`,
      certaintyKind: 'secondhand',
      certaintyLabel: 'Secondhand word',
      learnedDay: entry.learnedDay,
      valence: entry.valence,
      isNew,
    };
  }

  const directText = topicPhrase.endsWith('.')
    ? topicPhrase
    : `${topicPhrase.charAt(0).toUpperCase()}${topicPhrase.slice(1)}.`;

  return {
    entryKey,
    eventId: entry.eventId,
    text: directText,
    certaintyKind: 'direct',
    certaintyLabel:
      entry.sourceKind === 'player_told'
        ? 'Shared by you'
        : entry.sourceKind === 'witness'
        ? 'Mentioned observing'
        : 'Shared together',
    learnedDay: entry.learnedDay,
    valence: entry.valence,
    isNew,
  };
}

function buildMainStorySteps(
  world: WorldState,
  seenKeys: ReadonlySet<string>,
): JournalMainStoryStep[] {
  const f = world.flags;
  const steps: JournalMainStoryStep[] = [];

  // Before hearing the mystery, only surface the visible plaza observation — never spoil later acts
  if (!f.heardBellMystery) {
    const entryKey = 'main_gazebo_mystery_open';
    steps.push({
      id: 'mystery',
      entryKey,
      title: 'The Quiet Gazebo Bell',
      status: 'ongoing',
      detailText:
        'Thick ivy wraps the gazebo spire in the plaza. Ask Pip in the square or Nora at Linden Book Nook what quieted the bell.',
      isNew: !seenKeys.has(entryKey),
    });
    return steps;
  }

  const rawSteps: Array<{
    id: string;
    title: string;
    done: boolean;
    ongoingText: string;
    doneText: string;
  }> = [
    {
      id: 'mystery',
      title: 'The Quiet Gazebo Bell',
      done: true,
      ongoingText: '',
      doneText: 'Learned how the old brass bell fell quiet years ago.',
    },
    {
      id: 'ivy',
      title: 'Clear the Gazebo Rafters',
      done: f.clearedGazeboIvy,
      ongoingText: 'Ask Barnaby at Pinecone Woodshop about borrowing his cedar ladder.',
      doneText: 'Cleared the creeping ivy from the gazebo beams with Barnaby’s cedar ladder.',
    },
    {
      id: 'clapper',
      title: 'Recover the Brass Clapper',
      done: f.foundBrassClapper,
      ongoingText: 'Follow Toby’s clue near the Hollow Oak root by Mirror Pond.',
      doneText: 'Recovered the polished brass clapper from the mossy Hollow Oak root.',
    },
    {
      id: 'bridge',
      title: 'Soften Old Silences',
      done: f.deliveredPostcard || f.brewedChamomileTea || f.claraArthurReconciled,
      ongoingText:
        'Help Jun deliver Nora’s coastal postcard, or ask Sora for chamomile-pear tea.',
      doneText: f.claraArthurReconciled
        ? 'Clara and Arthur laid old silence aside together in the square.'
        : 'Carried a quiet olive branch that softened the space between old friends.',
    },
    {
      id: 'bell',
      title: 'Ring the Restored Bell Together',
      done: f.bellRestored,
      ongoingText:
        'Bring word of the clapper and clear rafters to Arthur at Copperwheel Cottage.',
      doneText: 'The brass bell hangs restored above Willow Step Lane.',
    },
  ];

  for (const s of rawSteps) {
    const status: JournalMainStoryStep['status'] = s.done ? 'completed' : 'ongoing';
    const entryKey = `main_gazebo_${s.id}_${status}`;
    steps.push({
      id: s.id,
      entryKey,
      title: s.title,
      status,
      detailText: s.done ? s.doneText : s.ongoingText,
      isNew: !seenKeys.has(entryKey),
    });
  }

  return steps;
}

function buildStorylinesProjection(
  world: WorldState,
  seenKeys: ReadonlySet<string>,
): {
  activeStorylines: JournalStorylineCard[];
  completedStorylines: JournalStorylineCard[];
} {
  const activeStorylines: JournalStorylineCard[] = [];
  const completedStorylines: JournalStorylineCard[] = [];
  const seenIds = new Set<string>();

  for (const def of STORYLINES) {
    if (seenIds.has(def.id)) continue;
    seenIds.add(def.id);

    const progress = getStorylineProgress(world, def.id);
    // Strict player-knowledge boundary: never expose undiscovered ('locked' or stage-0 'available') storylines
    if (progress.status !== 'active' && progress.status !== 'completed' && progress.stage <= 0) {
      continue;
    }

    const status: 'active' | 'completed' =
      progress.status === 'completed' ? 'completed' : 'active';
    const projection = projectStorylineForJournal(def, progress);
    const entryKey = `story_${def.id}_s${progress.stage}_${status}`;
    const onCooldown =
      status === 'active' && isStorylineOnCooldown(progress, world.day);

    const card: JournalStorylineCard = {
      id: def.id,
      entryKey,
      title: projection.title,
      subtitle: projection.subtitle,
      category: projection.category,
      status,
      stage: projection.stage,
      totalStages: projection.totalStages,
      stageTitle: projection.stageTitle,
      detailText: projection.hintText,
      // Never leak an outcome label before the storyline actually completes
      ...(status === 'completed' && projection.outcomeLabel
        ? { outcomeLabel: projection.outcomeLabel }
        : {}),
      involvedNames: projection.involvedResidents
        .filter((rid) => Boolean(RESIDENTS[rid]))
        .map((rid) => RESIDENTS[rid].name),
      ...(onCooldown && progress.cooldownUntilDay !== undefined
        ? {
            cooldownText: `Settling overnight — check back on Day ${progress.cooldownUntilDay}.`,
          }
        : {}),
      notes: projection.notes,
      ...(progress.startedDay !== undefined ? { startedDay: progress.startedDay } : {}),
      ...(progress.completedDay !== undefined ? { completedDay: progress.completedDay } : {}),
      isNew: !seenKeys.has(entryKey),
    };

    if (status === 'completed') {
      completedStorylines.push(card);
    } else {
      activeStorylines.push(card);
    }
  }

  return { activeStorylines, completedStorylines };
}

function buildMemoriesList(
  memories: readonly JournalMemory[],
  seenKeys: ReadonlySet<string>,
): JournalMemoryItem[] {
  return memories.map((mem) => {
    const entryKey = `mem_${mem.id}`;
    const residentName =
      mem.residentId && RESIDENTS[mem.residentId]
        ? RESIDENTS[mem.residentId].name
        : undefined;
    return {
      id: mem.id,
      entryKey,
      title: mem.title,
      summary: mem.summary,
      day: mem.day,
      phase: mem.phase,
      phaseLabel: formatTimePhaseLabel(mem.phase),
      ...(mem.residentId ? { residentId: mem.residentId } : {}),
      ...(residentName ? { residentName } : {}),
      isLegacySide: mem.id.startsWith('mem_side_'),
      isNew: !seenKeys.has(entryKey),
    };
  });
}

function collectDiscoveredConnections(
  residentId: ResidentId,
  world: WorldState,
  activeAndCompletedStorylines: readonly JournalStorylineCard[],
): string[] {
  const names = new Set<string>();

  // 1. Co-participants in discovered (active or completed) storylines
  for (const def of STORYLINES) {
    const isDiscovered = activeAndCompletedStorylines.some((c) => c.id === def.id);
    if (!isDiscovered) continue;
    if (!def.leadResidents.includes(residentId)) continue;
    for (const otherId of def.leadResidents) {
      if (otherId !== residentId && RESIDENTS[otherId]) {
        names.add(RESIDENTS[otherId].name);
      }
    }
  }

  // 2. Discovered Clara & Arthur tie (only once player hears the bell mystery or reconciles them)
  if (
    (world.flags.heardBellMystery || world.flags.claraArthurReconciled) &&
    (residentId === 'clara' || residentId === 'arthur')
  ) {
    const other = residentId === 'clara' ? 'arthur' : 'clara';
    if (RESIDENTS[other]) names.add(RESIDENTS[other].name);
  }

  // 3. Residents explicitly named in player-known memories shared by this resident
  const npcMems = world.npcMemories?.[residentId] ?? [];
  for (const m of npcMems) {
    if (!isNpcMemoryKnownToPlayer(m)) continue;
    for (const subj of m.subjectResidents) {
      if (subj !== residentId && RESIDENTS[subj]) {
        names.add(RESIDENTS[subj].name);
      }
    }
    if (m.fromResidentId && m.fromResidentId !== residentId && RESIDENTS[m.fromResidentId]) {
      names.add(RESIDENTS[m.fromResidentId].name);
    }
  }

  return Array.from(names);
}

function buildPeopleList(
  world: WorldState,
  phase: TimePhase,
  env: EnvironmentalState,
  discoveredStorylines: readonly JournalStorylineCard[],
  seenKeys: ReadonlySet<string>,
): JournalPersonCard[] {
  return RESIDENT_ORDER.map((id) => {
    const def = RESIDENTS[id];
    const prog = world.residents[id];
    const runtime = world.npcRuntime?.[id];
    const rel = world.playerRelations?.[id];
    const slot = getResidentScheduleSlot(id, phase, env.reconciledTogether);

    if (!prog.met) {
      const starterCue = id === 'pip' && !world.flags.heardBellMystery ? 'story' : 'none';
      const entryKey = `person_unmet_${id}`;
      return {
        id,
        entryKey,
        name: def.name,
        coatColor: def.appearance.coatColor,
        met: false,
        roleLabel: 'New face along the lane',
        placeLabel: 'Seen around Willow Step Lane',
        trust: 0,
        cueKind: starterCue,
        ...(starterCue === 'story' ? { cueTitle: 'Looking to chat in the square' } : {}),
        knownNotes: [],
        discoveredConnections: [],
        isNew: false,
      };
    }

    const affinity = rel?.affinity ?? prog.trust * 20;
    const trust = rel ? getHeartLevel(affinity) : prog.trust;
    const tier = getRelationshipTier(affinity);
    const tierLabel = getRelationshipTierLabel(tier);
    const emotion = runtime?.emotion ?? rel?.lastEmotion ?? moodToEmotion(prog.mood);
    const emotionLabel = getEmotionLabel(emotion);
    const reliabilityLabel = getReliabilityLabel(rel?.reliability ?? 25);

    const mainCue = getResidentAvailableQuestCue(id, world);
    const activeStoryCue = getActiveStorylineCue(id, world);
    const cueKind: JournalPersonCard['cueKind'] =
      mainCue !== 'none' ? mainCue : activeStoryCue ? 'story' : 'none';
    const cueTitle =
      activeStoryCue?.title ??
      (mainCue === 'ready'
        ? 'Has something ready to share'
        : mainCue === 'story'
        ? 'Story waiting'
        : undefined);

    const npcList = world.npcMemories?.[id] ?? [];
    const knownNotes = npcList
      .filter(isNpcMemoryKnownToPlayer)
      .slice()
      .sort((a, b) => {
        if (b.learnedDay !== a.learnedDay) return b.learnedDay - a.learnedDay;
        return b.learnedMinute - a.learnedMinute;
      })
      .slice(0, 5)
      .map((entry) => formatNpcMemoryForPlayer(id, entry, seenKeys));

    const discoveredConnections = collectDiscoveredConnections(
      id,
      world,
      discoveredStorylines,
    );

    const entryKey = `person_met_${id}`;
    const hasNewNote = knownNotes.some((n) => n.isNew);
    const isNew = !seenKeys.has(entryKey) || hasNewNote;

    return {
      id,
      entryKey,
      name: def.name,
      coatColor: def.appearance.coatColor,
      met: true,
      roleLabel: `${def.role} · ${def.homeName}`,
      placeLabel: runtime?.currentPlaceName ?? slot.placeName,
      personality: def.personality,
      trust,
      tier,
      tierLabel,
      emotionLabel,
      reliabilityLabel,
      cueKind,
      ...(cueTitle ? { cueTitle } : {}),
      knownNotes,
      discoveredConnections,
      isNew,
    };
  });
}

function buildDiscoveriesSection(
  world: WorldState,
  composed: ReturnType<typeof composeEnvironmentState>,
  seenKeys: ReadonlySet<string>,
): {
  landmarks: JournalDiscoveryLandmark[];
  laneMoments: JournalLaneMoment[];
} {
  const env = composed.playerChanges;
  const wishes = Number(world.sideFlags?.fountainWishesCount ?? 0);
  const skips = Number(world.sideFlags?.pondPebblesSkipped ?? 0);
  const lettersRead = world.dailyLettersRead?.length ?? 0;

  // M3 Build 6: the player's own journal may reflect the greenhouse's shared-corner state directly
  // (the player has seen it); no NPC-knowledge surfaces here.
  const gh = world.greenhouseState ?? createInitialGreenhouseState();
  const greenhouseSummary = summarizeGreenhousePlots(gh);
  // M3 Build 7: the bakery kitchen row reads only the player-observed bakery state.
  const bkToday = world.bakeryState ?? createInitialBakeryState();
  const todayBake = getBakeForDay(world.day);
  // M3 Build 8: the book nook row reads only the player-observed nook state.
  const nkToday = world.nookState ?? createInitialNookState();
  const todayBook = getFeaturedBookForDay(world.day);
  // M3 Build 9: the Copperwheel row reads only the player-observed workshop state.
  const cwToday = world.copperwheelState ?? createInitialCopperwheelState();
  const todayProject = getProjectForDay(world.day);

  const landmarksRaw: Array<Omit<JournalDiscoveryLandmark, 'entryKey' | 'isNew'>> = [
    {
      id: 'willow_cottage',
      name: 'Willow Step Cottage & Mailbox',
      statusKind: world.mailboxUnread ? 'active' : 'transformed',
      statusLabel: world.mailboxUnread ? 'Unread mail' : 'Up to date',
      summary: `${lettersRead} neighborhood ${lettersRead === 1 ? 'letter' : 'letters'} read${world.mailboxUnread ? ' · a fresh note waits in the mailbox' : ''}.`,
    },
    {
      id: 'stone_fountain',
      name: 'Sunlit Stone Fountain',
      statusKind: env.fountainFlowing ? 'transformed' : 'quiet',
      statusLabel: env.fountainFlowing ? 'Flowing clearly' : 'Clogged valve',
      summary: env.fountainFlowing
        ? wishes > 0
          ? `Clear spring water arcs across the basin · ${wishes} lucky ${wishes === 1 ? 'coin' : 'coins'} glinting below.`
          : 'Clear spring water arcs through all four bronze spouts.'
        : 'Dry autumn leaves still clog the old stone intake.',
    },
    {
      id: 'gazebo_bell',
      name: 'Old Bell Gazebo',
      statusKind: env.bellGleaming ? 'transformed' : env.ivyCleared ? 'active' : 'quiet',
      statusLabel: env.bellGleaming
        ? 'Restored & chiming'
        : env.ivyCleared
        ? 'Ivy cleared'
        : 'Ivy-wrapped',
      summary: env.bellGleaming
        ? world.bellRungCount > 0
          ? `Gleaming overhead · rung ${world.bellRungCount} ${world.bellRungCount === 1 ? 'time' : 'times'} across the square.`
          : 'Gleaming overhead and ready to chime across the square.'
        : env.ivyCleared
        ? 'Cedar rafters are clear of ivy; the bell still needs its clapper.'
        : 'Thick ivy curls around the cedar rafters.',
    },
    {
      id: 'mirror_pond',
      name: 'Mirror Pond & Cedar Bridge',
      statusKind: skips > 0 ? 'transformed' : 'active',
      statusLabel: skips > 0 ? `${skips} ${skips === 1 ? 'pebble' : 'pebbles'} skipped` : 'Calm water',
      summary: 'Arched cedar bridge over bright carp, lily pads, and reeds.',
    },
    {
      id: 'bakery_plaza',
      name: 'Hearth & Crumb & Plaza',
      statusKind: env.bakeryTablesOpen ? 'transformed' : 'quiet',
      statusLabel: env.bakeryTablesOpen ? 'Tables & lanterns open' : 'Quiet patio',
      summary: env.bakeryTablesOpen
        ? 'Sunlit café tables and festoon lanterns welcome neighbors into the lane.'
        : 'Warm sourdough aromas drift from the hearth window.',
    },
    {
      id: 'fern_hollow_orchard',
      name: 'Fern Hollow Orchard',
      statusKind:
        env.orchardGatheringOutcome && env.orchardGatheringOutcome !== 'none'
          ? 'transformed'
          : 'active',
      statusLabel:
        env.orchardGatheringOutcome === 'spiced_tart_table'
          ? 'Spiced Tart Table'
          : env.orchardGatheringOutcome === 'blossom_honey_picnic'
          ? 'Honey Picnic Open'
          : 'North lane open',
      summary:
        env.orchardGatheringOutcome === 'spiced_tart_table'
          ? 'Marigold lanterns sway above Clara’s warm crabapple tarts beside Rowan’s bee skep.'
          : env.orchardGatheringOutcome === 'blossom_honey_picnic'
          ? 'Mina’s honeyed chamomile teacups and lantern garlands welcome neighbors under the crabapple boughs.'
          : 'Dappled crabapple trees, harvest crates, and a bee skep beyond the stone gate.',
    },
    {
      id: 'sunbeam_greenhouse',
      name: 'Sunbeam Greenhouse',
      statusKind:
        greenhouseSummary.readyPlots > 0 || greenhouseSummary.growingPlots > 0
          ? 'active'
          : gh.totalHarvests > 0
          ? 'transformed'
          : 'quiet',
      statusLabel:
        greenhouseSummary.readyPlots > 0
          ? `${greenhouseSummary.readyPlots} ready to harvest`
          : greenhouseSummary.growingPlots > 0
          ? greenhouseSummary.growingPlots === 1
            ? '1 pot growing'
            : `${greenhouseSummary.growingPlots} pots growing`
          : gh.totalHarvests > 0
          ? 'Resting between sowings'
          : gh.noteReadDay > 0
          ? 'Shared corner open'
          : 'Mina’s glass corner',
      summary:
        greenhouseSummary.readyPlots > 0
          ? 'Ripe herbs glow on the shared growing shelf, ready for a gentle harvest.'
          : greenhouseSummary.growingPlots > 0
          ? greenhouseSummary.thirstyPlots > 0
            ? 'Young pots on Mina’s shelf are growing — some are still thirsty for today’s watering.'
            : 'Watered pots on the shared shelf are growing stronger with each sunny day.'
          : gh.totalHarvests > 0
          ? 'The shared pots rest between sowings — seeds folded and ready for the next planting.'
          : 'A warm glasshouse of herbs and blooms; Mina keeps a shared corner for tending neighbors.',
    },
    {
      id: 'claras_kitchen',
      name: 'Hearth & Crumb Kitchen',
      statusKind:
        bkToday.bakeCheckedDay > 0 || bkToday.loavesShared > 0 || bkToday.kneadingSessions > 0
          ? 'active'
          : 'quiet',
      statusLabel:
        bkToday.bakeCheckedDay === world.day && todayBake.id !== 'oven_rest'
          ? `Morning bake: ${todayBake.label}`
          : bkToday.bakeCheckedDay === world.day
          ? 'Oven resting today'
          : bkToday.loavesShared > 0
          ? `${bkToday.loavesShared} ${bkToday.loavesShared === 1 ? 'loaf' : 'loaves'} shared`
          : bkToday.kneadingSessions > 0
          ? 'Kneaded with Clara'
          : 'Clara’s warm kitchen',
      summary:
        bkToday.bakeCheckedDay === world.day
          ? todayBake.id === 'oven_rest'
            ? 'The brick dome rests on embers today — Clara says the sourdough whispers back tomorrow.'
            : `${todayBake.blurb}`
          : bkToday.loavesShared > 0
          ? 'Clara keeps a warm share wrapped in butter paper at the counter whenever a neighbor wanders in.'
          : 'A flour-warm kitchen behind the bakery porch — check the dome, help knead, take a loaf home.',
    },
    {
      id: 'linden_book_nook',
      name: 'Linden Book Nook',
      statusKind:
        nkToday.shelfBrowsedDay > 0 || nkToday.booksRead > 0 || nkToday.teasShared > 0
          ? 'active'
          : 'quiet',
      statusLabel:
        nkToday.shelfBrowsedDay === world.day
          ? `Reading: ${todayBook.title}`
          : nkToday.booksRead > 0
          ? `${nkToday.booksRead} of 4 books settled`
          : nkToday.teasShared > 0
          ? 'Reader’s tea poured'
          : 'Nora’s lamp-lit shelves',
      summary:
        nkToday.shelfBrowsedDay === world.day
          ? todayBook.blurb
          : nkToday.booksRead > 0
          ? 'The shelf rotates one featured book a day; the armchair remembers everyone who reads in it.'
          : 'A paper-and-lamp-oil reading corner behind the sage door — browse the shelf, take a reader’s cup, settle in.',
    },
    {
      id: 'copperwheel_cottage',
      name: 'Copperwheel Cottage',
      statusKind:
        cwToday.benchCheckedDay > 0 ||
        cwToday.projectsAdmired > 0 ||
        cwToday.teasShared > 0 ||
        cwToday.windingSessions > 0
          ? 'active'
          : 'quiet',
      statusLabel:
        cwToday.benchCheckedDay === world.day
          ? todayProject.id === 'bench_rest'
          ? 'Bench resting today'
          : `At the bench: ${todayProject.label}`
          : cwToday.projectsAdmired > 0
          ? `${cwToday.projectsAdmired} of 4 projects admired`
          : cwToday.windingSessions > 0
          ? 'Helped at the bench'
          : cwToday.teasShared > 0
          ? 'Tea shared at the kettle'
          : 'Arthur’s brass workshop',
      summary:
        cwToday.benchCheckedDay === world.day
          ? todayProject.id === 'bench_rest'
          ? 'The felt is rolled and the tools sleep in their oiled drawer — even clockmakers take a sabbath.'
          : todayProject.blurb
          : cwToday.projectsAdmired > 0
          ? 'One bench project rests on the felt each day; the mending ledger remembers every piece that came back to ticking.'
          : 'A warm brass-and-oakwood workshop behind the south door — check the bench, share the kettle, settle into the armchair.',
    },
  ];

  // The Wild Hollows (Build 10): these rows appear only after the player has actually
  // wandered into each place — the journal never reveals geography it hasn't seen.
  const sf = world.sideFlags ?? {};
  const posiesPicked = Number(sf.meadowPosiesPicked ?? 0);
  const pebblesDropped = Number(sf.wellPebblesCount ?? 0);
  const foxgloveGrowing =
    greenhouseSummary.growingPlots > 0 || greenhouseSummary.readyPlots > 0
      ? gh.plots.some((p) => p.cropId === 'foxglove')
      : false;
  const foxgloveFound = sf.foundFoxgloveSeeds
    ? true
    : (world.inventory?.foxglove_bloom ?? 0) > 0 ||
      (world.inventory?.foxglove_seeds ?? 0) > 0 ||
      foxgloveGrowing;

  if (sf.explored_marigold_lane) {
    landmarksRaw.push({
      id: 'marigold_lane',
      name: 'Marigold Lane',
      statusKind: posiesPicked > 0 ? 'active' : 'quiet',
      statusLabel: posiesPicked > 0 ? `${posiesPicked} ${posiesPicked === 1 ? 'posy' : 'posies'} picked` : 'A lane found',
      summary:
        'A petal-bright wildflower trail behind the greenhouse — marigolds, cornflowers and sweet alyssum the whole way down to Foxglove Rise.',
    });
  }
  if (sf.explored_foxglove_rise) {
    landmarksRaw.push({
      id: 'foxglove_rise',
      name: 'Foxglove Rise',
      statusKind: foxgloveFound ? 'transformed' : 'active',
      statusLabel: foxgloveGrowing
        ? 'Foxgloves growing below'
        : foxgloveFound
        ? 'Seeds carried home'
        : 'The whole valley in view',
      summary:
        'A terraced lookout knoll at the meadow’s south-east edge. From the cedar deck the pond, plaza, orchard and every rooftop read like a painted map.',
    });
  }
  if (sf.explored_sorrel_hollow) {
    landmarksRaw.push({
      id: 'sorrel_hollow',
      name: 'Sorrel Hollow & Old Well',
      statusKind: sf.foundFoxgloveSeeds || pebblesDropped > 0 ? 'active' : 'quiet',
      statusLabel: sf.foundFoxgloveSeeds
        ? 'Foxglove seeds found'
        : pebblesDropped > 0
        ? `${pebblesDropped} ${pebblesDropped === 1 ? 'pebble' : 'pebbles'} listened to`
        : 'A forgotten garden',
      summary:
        'A birch-shaded clearing past the pond’s south bank, where a mossy old stone well still keeps the hollow’s secrets among the wild sorrel.',
    });
  }
  if (sf.explored_bee_line) {
    landmarksRaw.push({
      id: 'bee_line',
      name: 'The Bee Line',
      statusKind: 'active',
      statusLabel: composed.season.season === 'winter' ? 'Quiet until spring' : 'Humming with wild bees',
      summary:
        'A clover trail east of the orchard running toward the Copperwheel meadows, past a mossy wild bee log that hums on warm afternoons.',
    });
  }

  const landmarks: JournalDiscoveryLandmark[] = landmarksRaw.map((lm) => {
    const entryKey = `landmark_${lm.id}_${lm.statusLabel}`;
    return {
      ...lm,
      entryKey,
      isNew: !seenKeys.has(entryKey),
    };
  });

  // Strict player-knowledge boundary: NEVER expose private 'npc_social' conversations
  const playerKnownEvents: WorldEventRecord[] = (world.worldEvents ?? [])
    .filter((ev) => ev.kind !== 'npc_social')
    .slice(0, 8);

  const laneMoments: JournalLaneMoment[] = playerKnownEvents.map((ev) => {
    const entryKey = `event_${ev.id}`;
    return {
      id: ev.id,
      entryKey,
      day: ev.day,
      phaseLabel: formatTimePhaseLabel(ev.phase),
      summary: ev.summary,
      isNew: !seenKeys.has(entryKey),
    };
  });

  return { landmarks, laneMoments };
}

export function buildPocketJournalView(
  world: WorldState,
  seenKeys: ReadonlySet<string> = new Set<string>(),
): PocketJournalView {
  const phase = getTimePhase(world.minuteOfDay);
  const phaseLabel = formatTimePhaseLabel(phase);
  const composed = composeEnvironmentState(world);

  const mainStorySteps = buildMainStorySteps(world, seenKeys);
  const { activeStorylines, completedStorylines } = buildStorylinesProjection(
    world,
    seenKeys,
  );
  const allDiscoveredStorylines = [...activeStorylines, ...completedStorylines];

  const memories = buildMemoriesList(world.memories, seenKeys);
  const people = buildPeopleList(
    world,
    phase,
    composed.playerChanges,
    allDiscoveredStorylines,
    seenKeys,
  );
  const { landmarks, laneMoments } = buildDiscoveriesSection(
    world,
    composed,
    seenKeys,
  );

  const storiesKeys = [
    ...mainStorySteps.map((s) => s.entryKey),
    ...allDiscoveredStorylines.map((s) => s.entryKey),
  ];
  const memoriesKeys = memories.map((m) => m.entryKey);
  const peopleKeys = people.flatMap((p) =>
    p.met ? [p.entryKey, ...p.knownNotes.map((n) => n.entryKey)] : [],
  );
  const discoveriesKeys = [
    ...landmarks.map((l) => l.entryKey),
    ...laneMoments.map((m) => m.entryKey),
  ];

  const storiesNew =
    mainStorySteps.filter((s) => s.isNew).length +
    allDiscoveredStorylines.filter((s) => s.isNew).length;
  const memoriesNew = memories.filter((m) => m.isNew).length;
  const peopleNew = people.filter((p) => p.isNew).length;
  const discoveriesNew =
    landmarks.filter((l) => l.isNew).length +
    laneMoments.filter((m) => m.isNew).length;

  const cottage = world.cottageState;
  const placedFlowerId = cottage?.placedFlowerId ?? null;
  const homeSummary: JournalHomeSummary = {
    placedFlowerLabel: placedFlowerId ? (PERSONAL_ITEM_MAP[placedFlowerId]?.label ?? null) : null,
    vaseDescription: describePlacedFlower(placedFlowerId),
    displayedKeepsakeLabels: (cottage?.displayedKeepsakeIds ?? [])
      .map((kid) => PERSONAL_ITEM_MAP[kid]?.label)
      .filter((label): label is string => Boolean(label)),
    discoveredCount: world.discoveredItemIds?.length ?? 0,
    totalItemCatalogCount: PERSONAL_ITEMS.length,
    cottageRestCount: cottage?.cottageRestCount ?? 0,
    almanacReadToday: Boolean(cottage?.almanacReadToday),
    homeRitualCount: world.memories.filter((m) => m.id.startsWith('mem_teatable_')).length,
  };

  return {
    day: world.day,
    phase,
    phaseLabel,
    seasonLabel: composed.season.seasonLabel,
    dayOfSeason: composed.season.dayOfSeason,
    year: composed.season.year,
    weatherLabel: getWeatherLabel(composed.weather.effective),
    tomorrowForecastLabel: getWeatherLabel(composed.weather.tomorrowForecast),
    memories,
    mainStoryTitle: 'The Silent Gazebo Bell',
    mainStorySteps,
    activeStorylines,
    completedStorylines,
    people,
    landmarks,
    laneMoments,
    homeSummary,
    noticeboardFlyerCount: composed.npcTouches.noticeboardFlyerCount,
    greenhouseStage: composed.npcTouches.minaGreenhouseStage,
    plantersBloomed: composed.playerChanges.plantersBloomed,
    newCounts: {
      stories: storiesNew,
      memories: memoriesNew,
      people: peopleNew,
      discoveries: discoveriesNew,
    },
    tabEntryKeys: {
      stories: storiesKeys,
      memories: memoriesKeys,
      people: peopleKeys,
      discoveries: discoveriesKeys,
    },
  };
}
