import {
  CharacterEmotion,
  DialogueCategory,
  DialogueChoice,
  DialogueCondition,
  DialogueNode,
  DialogueSession,
  DialogueTopic,
  RelationshipTier,
  ResidentId,
  StoryFlags,
  TimePhase,
  TopicHistoryEntry,
  WorldState,
} from './types';
import { RESIDENTS } from './residents';
import {
  getEmotionLabel,
  getNpcRelation,
  getRelationshipTier,
  moodToEmotion,
} from './relationships';
import { getTimePhase } from './time';
import { getSeatById } from './worldMap';

const CATEGORY_PRIORITY: Record<DialogueCategory, number> = {
  quest_milestone: 100,
  conflict_reconciliation: 84,
  personal_story: 76,
  event_reaction: 68,
  relationship_tier: 60,
  emotion_reaction: 54,
  npc_gossip: 48,
  weather_season: 42,
  daily_slice: 34,
};

const TIER_RANK: Record<RelationshipTier, number> = {
  stranger: 0,
  acquaintance: 1,
  friendly: 2,
  close: 3,
  kindred: 4,
};

interface ForwardWorldHooks {
  npcMemories?: Record<string, Array<{ id: string; tag: string }>>;
  storylines?: Record<string, { id: string; stage: number; status: string; outcome?: string }>;
}

export function getTopicHistoryKey(
  topic: Pick<DialogueTopic, 'id' | 'residentId' | 'historyScope'>,
  residentId: ResidentId,
): string {
  if (topic.residentId === 'any' && topic.historyScope !== 'global') {
    return `${residentId}:${topic.id}`;
  }
  return topic.id;
}

export function getTopicHistoryEntry(
  world: WorldState,
  residentId: ResidentId,
  topicId: string,
): TopicHistoryEntry | undefined {
  if (!topicId) return undefined;
  const hist = world.topicHistory ?? {};
  return hist[`${residentId}:${topicId}`] ?? hist[topicId];
}

function isWorldStateArg(arg: StoryFlags | WorldState): arg is WorldState {
  return (
    typeof arg === 'object' &&
    arg !== null &&
    'residents' in arg &&
    'flags' in arg
  );
}

export function isChoiceAvailable(
  choice: DialogueChoice,
  world: WorldState,
  residentId: ResidentId,
): boolean;
export function isChoiceAvailable(
  choice: DialogueChoice,
  flags: StoryFlags,
  trust: number,
  sideFlags?: Record<string, boolean | number | string>,
): boolean;
export function isChoiceAvailable(
  choice: DialogueChoice,
  flagsOrWorld: StoryFlags | WorldState,
  trustOrResidentId: number | ResidentId = 0,
  sideFlags: Record<string, boolean | number | string> = {},
): boolean {
  if (isWorldStateArg(flagsOrWorld)) {
    const world = flagsOrWorld;
    const residentId = trustOrResidentId as ResidentId;
    const flags = world.flags;
    const sf = world.sideFlags ?? {};
    const prog = world.residents[residentId];
    const rel = world.playerRelations?.[residentId];
    const trust = prog?.trust ?? 0;
    const affinity = rel?.affinity ?? trust * 20;
    const tier = getRelationshipTier(affinity);

    if (choice.requiresFlag && !flags[choice.requiresFlag]) return false;
    if (choice.requiresFalseFlag && flags[choice.requiresFalseFlag]) return false;
    if (choice.requiresSideFlag && !sf[choice.requiresSideFlag]) return false;
    if (choice.requiresFalseSideFlag && sf[choice.requiresFalseSideFlag]) return false;
    if (choice.minTrust !== undefined && trust < choice.minTrust) return false;
    if (choice.minAffinity !== undefined && affinity < choice.minAffinity) return false;
    if (choice.minTier && TIER_RANK[tier] < TIER_RANK[choice.minTier]) return false;
    if (choice.requiresCondition) {
      const phase = getTimePhase(world.minuteOfDay);
      if (!evaluateDialogueCondition(choice.requiresCondition, residentId, world, phase, '')) {
        return false;
      }
    }
    return true;
  }

  const flags = flagsOrWorld;
  const trust = typeof trustOrResidentId === 'number' ? trustOrResidentId : 0;
  if (choice.requiresFlag && !flags[choice.requiresFlag]) return false;
  if (choice.requiresFalseFlag && flags[choice.requiresFalseFlag]) return false;
  if (choice.requiresSideFlag && !sideFlags[choice.requiresSideFlag]) return false;
  if (choice.requiresFalseSideFlag && sideFlags[choice.requiresFalseSideFlag]) return false;
  if (choice.minTrust !== undefined && trust < choice.minTrust) return false;
  return true;
}

export function evaluateDialogueCondition(
  cond: DialogueCondition | undefined,
  residentId: ResidentId,
  world: WorldState,
  phase: TimePhase,
  topicId: string,
): boolean {
  if (!cond) return true;
  const f = world.flags;
  const sf = world.sideFlags ?? {};
  const prog = world.residents[residentId];
  const rel = world.playerRelations?.[residentId];
  const rt = world.npcRuntime?.[residentId];
  const def = RESIDENTS[residentId];
  const affinity = rel?.affinity ?? prog.trust * 20;
  const tier = getRelationshipTier(affinity);

  const emotion: CharacterEmotion =
    rt?.emotion ?? rel?.lastEmotion ?? moodToEmotion(prog.mood);

  if (cond.flagsTrue) {
    for (const k of cond.flagsTrue) if (!f[k]) return false;
  }
  if (cond.flagsFalse) {
    for (const k of cond.flagsFalse) if (f[k]) return false;
  }
  if (cond.sideFlagsTrue) {
    for (const k of cond.sideFlagsTrue) if (!sf[k]) return false;
  }
  if (cond.sideFlagsFalse) {
    for (const k of cond.sideFlagsFalse) if (sf[k]) return false;
  }

  if (cond.minTrust !== undefined && prog.trust < cond.minTrust) return false;
  if (cond.maxTrust !== undefined && prog.trust > cond.maxTrust) return false;
  if (cond.minAffinity !== undefined && affinity < cond.minAffinity) return false;
  if (cond.minTier && TIER_RANK[tier] < TIER_RANK[cond.minTier]) return false;
  if (cond.maxTier && TIER_RANK[tier] > TIER_RANK[cond.maxTier]) return false;
  if (cond.minReliability !== undefined && (rel?.reliability ?? 25) < cond.minReliability) return false;
  if (cond.requiresMet !== undefined && prog.met !== cond.requiresMet) return false;
  if (cond.talkedCountMin !== undefined && (rel?.talkedCount ?? 0) < cond.talkedCountMin) return false;

  if (cond.minNpcAffinity) {
    const pairRel = getNpcRelation(world.npcRelations ?? {}, cond.minNpcAffinity.a, cond.minNpcAffinity.b);
    if (pairRel.affinity < cond.minNpcAffinity.min) return false;
  }
  if (cond.maxNpcAffinity) {
    const pairRel = getNpcRelation(world.npcRelations ?? {}, cond.maxNpcAffinity.a, cond.maxNpcAffinity.b);
    if (pairRel.affinity > cond.maxNpcAffinity.max) return false;
  }
  if (cond.minNpcTension) {
    const pairRel = getNpcRelation(world.npcRelations ?? {}, cond.minNpcTension.a, cond.minNpcTension.b);
    if (pairRel.tension < cond.minNpcTension.min) return false;
  }

  if (cond.emotions && !cond.emotions.includes(emotion)) return false;
  if (cond.excludeEmotions && cond.excludeEmotions.includes(emotion)) return false;
  if (cond.phases && !cond.phases.includes(phase)) return false;
  if (cond.weathers && !cond.weathers.includes(world.weather)) return false;
  if (cond.requiresWeatherNot && cond.requiresWeatherNot.includes(world.weather)) return false;
  if (cond.seasons && !cond.seasons.includes(world.season)) return false;
  if (cond.requiresPosture && !cond.requiresPosture.includes(rt?.posture ?? 'standing')) return false;

  if (cond.requiresTraits) {
    const t = def.traits;
    if (cond.requiresTraits.minSociability !== undefined && t.sociability < cond.requiresTraits.minSociability) {
      return false;
    }
    if (cond.requiresTraits.minOutdoorsiness !== undefined && t.outdoorsiness < cond.requiresTraits.minOutdoorsiness) {
      return false;
    }
    if (cond.requiresTraits.minMorningLark !== undefined && t.morningLark < cond.requiresTraits.minMorningLark) {
      return false;
    }
    if (cond.requiresTraits.minCuriosity !== undefined && t.curiosity < cond.requiresTraits.minCuriosity) {
      return false;
    }
    if (cond.requiresTraits.rainBehavior && t.rainBehavior !== cond.requiresTraits.rainBehavior) {
      return false;
    }
  }

  if (cond.requiresRecentEventKind) {
    const maxDay = cond.requiresRecentEventKind.maxDaysAgo;
    const found = (world.worldEvents ?? []).some(
      (ev) =>
        ev.kind === cond.requiresRecentEventKind!.kind &&
        world.day - ev.day <= maxDay &&
        ev.day <= world.day,
    );
    if (!found) return false;
  }

  if (cond.requiresRecentEventTag) {
    const maxDay = cond.requiresRecentEventTag.maxDaysAgo;
    const prefix = cond.requiresRecentEventTag.tagPrefix;
    const found = (world.worldEvents ?? []).some(
      (ev) =>
        ev.summaryTag.startsWith(prefix) &&
        world.day - ev.day <= maxDay &&
        ev.day <= world.day,
    );
    if (!found) return false;
  }

  const hooks = world as WorldState & ForwardWorldHooks;
  if (cond.requiresNpcMemoriesAny && cond.requiresNpcMemoriesAny.length > 0) {
    const mems = hooks.npcMemories?.[residentId] ?? [];
    const matched = mems.some(
      (m) =>
        cond.requiresNpcMemoriesAny!.includes(m.tag) ||
        cond.requiresNpcMemoriesAny!.includes(m.id),
    );
    if (!matched) return false;
  }
  if (cond.excludesNpcMemories && cond.excludesNpcMemories.length > 0) {
    const mems = hooks.npcMemories?.[residentId] ?? [];
    const blocked = mems.some(
      (m) =>
        cond.excludesNpcMemories!.includes(m.tag) ||
        cond.excludesNpcMemories!.includes(m.id),
    );
    if (blocked) return false;
  }
  if (cond.requiresStoryline) {
    const req = cond.requiresStoryline;
    const progStory = hooks.storylines?.[req.id];
    const status = progStory?.status ?? 'available';
    const stage = progStory?.stage ?? 0;
    if (req.status && !req.status.includes(status as 'locked' | 'available' | 'active' | 'completed')) {
      return false;
    }
    if (req.minStage !== undefined && stage < req.minStage) return false;
    if (req.maxStage !== undefined && stage > req.maxStage) return false;
    if (req.outcome !== undefined && progStory?.outcome !== req.outcome) return false;
  }

  const hist = getTopicHistoryEntry(world, residentId, topicId);
  if (hist) {
    if (cond.notSeenToday && hist.lastSeenDay === world.day) return false;
    if (cond.minDaysSinceSeen !== undefined && world.day - hist.lastSeenDay < cond.minDaysSinceSeen) {
      return false;
    }
    if (cond.maxSeenCount !== undefined && hist.seenCount >= cond.maxSeenCount) return false;
  }

  return true;
}

export function phaseGreet(phase: TimePhase): string {
  if (phase === 'morning') return 'Morning air feels crisp today.';
  if (phase === 'afternoon') return 'The afternoon sun makes the cobbles warm.';
  if (phase === 'golden') return 'This golden light always slows the lane down.';
  return 'Lantern dusk is my favorite hour here.';
}

export function makeSimpleTopic(
  id: string,
  residentId: ResidentId | 'any',
  category: DialogueCategory,
  priority: number,
  condition: DialogueCondition | undefined,
  spec: {
    moodLabel: string;
    buildText: (resId: ResidentId, world: WorldState, phase: TimePhase) => string;
    choices: DialogueChoice[];
    endings: Record<string, { moodLabel: string; text: string }>;
    historyScope?: 'resident' | 'global';
  },
): DialogueTopic {
  return {
    id,
    residentId,
    category,
    priority,
    historyScope: spec.historyScope,
    condition,
    build: (resId, world, phase) => {
      const def = RESIDENTS[resId];
      const nodes: Record<string, DialogueNode> = {
        root: {
          id: 'root',
          speakerName: def.name,
          speakerRole: def.role,
          moodLabel: spec.moodLabel,
          text: spec.buildText(resId, world, phase),
          choices: spec.choices,
        },
      };
      for (const [endId, endSpec] of Object.entries(spec.endings)) {
        nodes[endId] = {
          id: endId,
          speakerName: def.name,
          speakerRole: def.role,
          moodLabel: endSpec.moodLabel,
          text: endSpec.text,
          choices: [],
          isEnd: true,
        };
      }
      return { rootId: 'root', nodes };
    },
  };
}

export interface DeclarativeNodeSpec {
  moodLabel: string;
  text: string;
  choices?: DialogueChoice[];
  isEnd?: boolean;
}

export function makeBranchingTopic(
  id: string,
  residentId: ResidentId | 'any',
  category: DialogueCategory,
  priority: number,
  condition: DialogueCondition | undefined,
  buildSpec: (
    resId: ResidentId,
    world: WorldState,
    phase: TimePhase,
  ) => {
    rootId?: string;
    nodes: Record<string, DeclarativeNodeSpec>;
  },
  historyScope?: 'resident' | 'global',
): DialogueTopic {
  return {
    id,
    residentId,
    category,
    priority,
    historyScope,
    condition,
    build: (resId, world, phase) => {
      const def = RESIDENTS[resId];
      const spec = buildSpec(resId, world, phase);
      const nodes: Record<string, DialogueNode> = {};
      for (const [nodeId, n] of Object.entries(spec.nodes)) {
        const choices = n.choices ?? [];
        nodes[nodeId] = {
          id: nodeId,
          speakerName: def.name,
          speakerRole: def.role,
          moodLabel: n.moodLabel,
          text: n.text,
          choices,
          isEnd: n.isEnd ?? choices.length === 0,
        };
      }
      return { rootId: spec.rootId ?? 'root', nodes };
    },
  };
}

function resolveGreetingPrefix(
  id: ResidentId,
  emotion: CharacterEmotion,
  tier: RelationshipTier,
  phase: TimePhase,
  world: WorldState,
): string {
  const def = RESIDENTS[id];
  const prog = world.residents[id];

  if (!prog.met) {
    if (def.traits.temperament === 'spirited') {
      return `Oh! You’re the new neighbor down Willow Step Lane!`;
    }
    if (def.traits.temperament === 'contemplative') {
      return `Ah… you must be settling into Willow Step Cottage.`;
    }
    return `Welcome to Willow Step Lane.`;
  }

  if (emotion === 'tired') {
    return phase === 'dusk' ? `Whew… long day on my feet.` : `Trying to catch a quick breather here.`;
  }
  if (emotion === 'sad') {
    return `The square feels a little heavy today…`;
  }
  if (emotion === 'frustrated' || emotion === 'angry') {
    return `Look, I’ve got plenty on my mind right now.`;
  }
  if (tier === 'kindred' || tier === 'close') {
    return phase === 'dusk'
      ? `There’s my favorite company—just in time for lantern hour.`
      : `Good to see you, neighbor! The lane always feels steadier when you’re around.`;
  }
  return phaseGreet(phase);
}

/**
 * Produces an actor-local ambient remark (current bench seat or a direct social chat the resident participated in).
 */
function resolveContextFlavorRemark(id: ResidentId, world: WorldState): string {
  const rt = world.npcRuntime?.[id];
  if (rt?.posture === 'sitting' && rt.reservedSeatId) {
    const seat = getSeatById(rt.reservedSeatId);
    if (seat) {
      return ` This ${seat.label.toLowerCase()} catches the best breeze in town.`;
    }
  }
  const recentSocial = (world.worldEvents ?? []).find(
    (e) => e.kind === 'npc_social' && e.day === world.day && e.actors.includes(id),
  );
  const partnerId = recentSocial?.actors.find((a) => a !== id);
  if (partnerId && RESIDENTS[partnerId]) {
    return ` (I stopped to chat with ${RESIDENTS[partnerId].name} earlier—made the hour fly by.)`;
  }
  return '';
}

function buildDynamicGiftChoice(
  id: ResidentId,
  world: WorldState,
  endNodeId: string,
  nodes: Record<string, DialogueNode>,
): DialogueChoice | null {
  const heldId = world.playerHeldItem;
  if (!heldId || !world.worldProps?.[heldId]) return null;
  const prop = world.worldProps[heldId];
  const likesIt = prop.likedBy.includes(id);
  const def = RESIDENTS[id];

  nodes[endNodeId] = {
    id: endNodeId,
    speakerName: def.name,
    speakerRole: def.role,
    moodLabel: likesIt ? 'Delighted' : 'Thankful',
    text: likesIt
      ? `Wait—is that ${prop.label}? You brought it all the way over for me! That genuinely made my entire day.`
      : `Oh, thank you for carrying ${prop.label} over! I’ll make sure it finds a tidy spot on the porch.`,
    choices: [],
    isEnd: true,
  };

  return {
    id: `deliver_${heldId}_to_${id}`,
    label: likesIt ? `Give ${prop.label} (${def.name} loves this!)` : `Share ${prop.label}`,
    tone: 'warm',
    nextNodeId: endNodeId,
    trustDelta: likesIt ? 1 : 0,
    reliabilityDelta: likesIt ? 10 : 5,
    setEmotion: likesIt ? 'excited' : 'happy',
    deliverHeldItem: heldId,
  };
}

export function selectDialogueSession(
  residentId: ResidentId,
  world: WorldState,
  phase: TimePhase,
  topics: readonly DialogueTopic[],
  buildConcurrentChoices: (residentId: ResidentId, world: WorldState) => {
    choices: DialogueChoice[];
    extraNodes: Record<string, DialogueNode>;
  },
): DialogueSession {
  const def = RESIDENTS[residentId];
  const prog = world.residents[residentId];
  const rel = world.playerRelations?.[residentId];
  const rt = world.npcRuntime?.[residentId];
  const affinity = rel?.affinity ?? prog.trust * 20;
  const tier = getRelationshipTier(affinity);
  const emotion: CharacterEmotion =
    rt?.emotion ?? rel?.lastEmotion ?? moodToEmotion(prog.mood);

  const lastTopicId = (world.lastTopicByResident ?? {})[residentId];

  const matching: Array<{ topic: DialogueTopic; score: number }> = [];
  for (const topic of topics) {
    if (topic.residentId !== 'any' && topic.residentId !== residentId) continue;
    if (!evaluateDialogueCondition(topic.condition, residentId, world, phase, topic.id)) continue;

    let score = CATEGORY_PRIORITY[topic.category] + (topic.priority ?? 0);
    const hist = getTopicHistoryEntry(world, residentId, topic.id);
    if (hist) {
      if (hist.lastSeenDay === world.day) score -= 28;
      else score -= Math.min(20, hist.seenCount * 5);
    }
    if (topic.id === lastTopicId) {
      score -= 120; // Strict anti-back-to-back repeat unless it is a pinned quest milestone
    }
    matching.push({ topic, score });
  }

  matching.sort((a, b) => b.score - a.score);

  // Never repeat the last non-quest topic if any alternative topic is available
  let chosenEntry = matching[0];
  if (
    chosenEntry &&
    chosenEntry.topic.id === lastTopicId &&
    chosenEntry.topic.category !== 'quest_milestone' &&
    matching.length > 1
  ) {
    chosenEntry = matching[1];
  }

  if (!chosenEntry) {
    const fallbackNode: DialogueNode = {
      id: 'root',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: getEmotionLabel(emotion),
      text: `${resolveGreetingPrefix(residentId, emotion, tier, phase, world)}${resolveContextFlavorRemark(residentId, world)}`,
      choices: [
        {
          id: `${residentId}_kind_check_in`,
          label: 'Just checking in on you along the lane.',
          tone: 'warm',
          nextNodeId: 'fallback_end',
          trustDelta: 1,
          setEmotion: 'happy',
        },
      ],
    };
    return {
      residentId,
      topicId: `${residentId}_fallback`,
      topicHistoryKey: `${residentId}_fallback`,
      category: 'daily_slice',
      emotion,
      tier,
      currentNodeId: 'root',
      nodes: {
        root: fallbackNode,
        fallback_end: {
          id: 'fallback_end',
          speakerName: def.name,
          speakerRole: def.role,
          moodLabel: 'Warm',
          text: `Glad you stopped by—the cobbles feel kinder with neighbors saying hello.`,
          choices: [],
          isEnd: true,
        },
      },
    };
  }

  const built = chosenEntry.topic.build(residentId, world, phase);
  const nodes: Record<string, DialogueNode> = {};
  for (const [k, node] of Object.entries(built.nodes)) {
    nodes[k] = {
      ...node,
      choices: [...node.choices],
    };
  }

  const root = nodes[built.rootId] ?? nodes['root'];
  const rootChoices = [...root.choices];

  // Inject concurrent quest milestones cleanly without duplicates
  const concurrent = buildConcurrentChoices(residentId, world);
  for (const [k, v] of Object.entries(concurrent.extraNodes)) {
    if (!nodes[k]) nodes[k] = v;
  }
  const existingIds = new Set(rootChoices.map((c) => c.id));
  for (const c of concurrent.choices) {
    if (!existingIds.has(c.id)) {
      rootChoices.unshift(c);
      existingIds.add(c.id);
    }
  }

  // Inject held carryable item delivery option if player is holding something
  const giftChoice = buildDynamicGiftChoice(residentId, world, 'gift_delivered_end', nodes);
  if (giftChoice && !existingIds.has(giftChoice.id)) {
    rootChoices.push(giftChoice);
    existingIds.add(giftChoice.id);
  }

  // Inject heartfelt amends option whenever resident feels frustrated/embarrassed/angry or reliability slipped
  const needsAmends =
    (rel && rel.negativeCount > 0 && (rel.reliability < 40 || emotion === 'frustrated' || emotion === 'embarrassed' || emotion === 'angry')) &&
    chosenEntry.topic.category !== 'quest_milestone';
  const amendsId = `make_amends_${residentId}`;
  if (needsAmends && !existingIds.has(amendsId)) {
    nodes['amends_end'] = {
      id: 'amends_end',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Softened',
      text: `Thank you for saying that honestly. Neighbors don’t always get the first word right—what matters is showing up gently afterwards.`,
      choices: [],
      isEnd: true,
    };
    rootChoices.push({
      id: amendsId,
      label: `I was too blunt earlier—I’m sorry, ${def.name}.`,
      tone: 'gentle',
      nextNodeId: 'amends_end',
      trustDelta: 0,
      reliabilityDelta: 9,
      setEmotion: 'relaxed',
    });
  }

  // Add subtle context recognition prefix on non-quest topics when holding a liked item
  let rootText = root.text;
  const heldProp = world.playerHeldItem ? world.worldProps?.[world.playerHeldItem] : null;
  if (
    heldProp &&
    heldProp.likedBy.includes(residentId) &&
    chosenEntry.topic.category !== 'quest_milestone' &&
    !rootText.includes(heldProp.label)
  ) {
    rootText = `Oh—is that ${heldProp.label} you’re carrying? ${rootText}`;
  }

  // Surface actor-local sitting or recent social context on casual daily_slice conversations
  if (chosenEntry.topic.category === 'daily_slice') {
    const contextRemark = resolveContextFlavorRemark(residentId, world);
    if (contextRemark && !rootText.includes(contextRemark.trim())) {
      rootText = `${rootText}${contextRemark}`;
    }
  }

  nodes['root'] = {
    ...root,
    text: rootText,
    moodLabel: root.moodLabel || getEmotionLabel(emotion),
    choices: rootChoices,
  };

  return {
    residentId,
    topicId: chosenEntry.topic.id,
    topicHistoryKey: getTopicHistoryKey(chosenEntry.topic, residentId),
    category: chosenEntry.topic.category,
    emotion,
    tier,
    currentNodeId: 'root',
    nodes,
  };
}

