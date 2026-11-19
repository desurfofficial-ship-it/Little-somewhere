import {
  ResidentId,
  StoryFlags,
  StorylineAdvanceSpec,
  StorylineDefinition,
  StorylineProgress,
  StorylineStatus,
  WorldState,
} from './types';

export const MAX_STORYLINE_NOTES = 6;

export const VALID_STORYLINE_STATUSES = new Set<StorylineStatus>([
  'locked',
  'available',
  'active',
  'completed',
]);

export const STORYLINES: readonly StorylineDefinition[] = [
  {
    id: 'side_pip_zine',
    title: 'Willow Lane Zine',
    subtitle: 'Pip, Nora & neighbor contributors stitch the lane’s first pocket booklet.',
    category: 'personal_story',
    leadResidents: ['pip', 'nora', 'toby', 'clara'],
    stages: [
      {
        stage: 1,
        title: 'Chalk-Dust Drafts',
        journalHint:
          'Pip wants three neighborhood tales for Issue #1—check with Toby or Clara for a guest page, or take Pip’s draft straight to Nora.',
        involvedResidents: ['pip'],
        unlockCondition: { minTrust: 1 },
      },
      {
        stage: 2,
        title: 'A Neighbor’s Page',
        journalHint:
          'Guest material is ready—bring word back to Nora at Linden Book Nook to bind Issue #1.',
        involvedResidents: ['toby', 'clara'],
      },
      {
        stage: 3,
        title: 'Issue #1 on the Counter',
        journalHint:
          'Willow Lane Zine sits stitched and warm on the Linden Book Nook counter.',
        involvedResidents: ['nora', 'pip'],
      },
    ],
    outcomes: {
      art_edition: {
        label: 'Pond & Lantern Art Edition',
        journalSummary:
          'Pip and Nora bound Toby’s carp-and-lantern watercolors right alongside Pip’s chalk stories.',
      },
      kitchen_edition: {
        label: 'Hearth & Recipe Edition',
        journalSummary:
          'Pip and Nora bound Clara’s rosemary crust notes into a hearth-scented first issue.',
      },
      classic_edition: {
        label: 'First Chalk Pocket Edition',
        journalSummary:
          'Nora stitched Pip’s chalk drawings and fountain stories into the neighborhood’s first pocket zine.',
      },
    },
  },
  {
    id: 'side_herb_loaf',
    title: 'Seasonal Herb & Hearth',
    subtitle: 'Mina’s lemon-thyme harvest meets Sora’s tea pairings and Clara’s stone oven.',
    category: 'personal_story',
    leadResidents: ['mina', 'sora', 'clara'],
    stages: [
      {
        stage: 1,
        title: 'Sun-Warmed Sprigs',
        journalHint:
          'Mina snipped lemon-thyme for Clara’s oven—check with Sora near the tea cart to plan the pairing, or visit Clara at Hearth & Crumb.',
        involvedResidents: ['mina'],
        unlockCondition: { minTrust: 1 },
      },
      {
        stage: 2,
        title: 'Steeping & Proofing',
        journalHint:
          'Sora matched the loaf with a serving plan—share the verdict with Clara as the crust crackles.',
        involvedResidents: ['sora', 'mina'],
      },
      {
        stage: 3,
        title: 'Loaves in the Sun',
        journalHint:
          'Mina’s greenhouse herbs and Clara’s sourdough found their way across Willow Step Lane.',
        involvedResidents: ['clara', 'mina', 'sora'],
      },
    ],
    outcomes: {
      plaza_table: {
        label: 'Plaza Sharing Table',
        journalSummary:
          'Clara laid warm lemon-thyme slices across the fountain benches for every passing neighbor.',
      },
      tea_basket: {
        label: 'Greenhouse Tea Basket',
        journalSummary:
          'Clara and Sora packed warm sourdough heels alongside chamomile-pear tea for Mina’s greenhouse porch.',
      },
    },
  },
  {
    id: 'side_pond_stand',
    title: 'Cedar Music Stand',
    subtitle: 'Keeping Sora’s sheet music dry and steady beside Mirror Pond.',
    category: 'personal_story',
    leadResidents: ['sora', 'toby', 'barnaby'],
    stages: [
      {
        stage: 1,
        title: 'Wind on the Sheet Music',
        journalHint:
          'Sora needs a wind-steady music stand—Toby can sketch the lakeside gusts, or Barnaby can plane one straight at Pinecone Woodshop.',
        involvedResidents: ['sora'],
        unlockCondition: { minTrust: 1 },
      },
      {
        stage: 2,
        title: 'Grain & Acoustics',
        journalHint:
          'Toby sketched the pier wind-angle—visit Barnaby at Pinecone Woodshop to finish the joinery.',
        involvedResidents: ['toby', 'sora'],
      },
      {
        stage: 3,
        title: 'Beeswax & Cedar Shavings',
        journalHint:
          'Barnaby’s cedar music stand holds every afternoon violin etude steady above the reeds.',
        involvedResidents: ['barnaby', 'sora'],
      },
    ],
    outcomes: {
      carved_clef: {
        label: 'Treble-Clef Cedar Stand',
        journalSummary:
          'Barnaby inlaid a hand-carved treble clef along the lip to celebrate Sora’s pond recitals.',
      },
      weatherproof_oak: {
        label: 'Storm-Braced Oak Stand',
        journalSummary:
          'Following Toby’s wind sketch, Barnaby weighted the stand with oiled oak so pond breezes never tip a page.',
      },
    },
  },
  {
    id: 'side_jun_watch',
    title: 'True on the Route',
    subtitle: 'Settling Jun’s morning mail anxiety and balancing his brass pocket watch.',
    category: 'personal_story',
    leadResidents: ['jun', 'nora', 'arthur'],
    stages: [
      {
        stage: 1,
        title: 'Four Lost Minutes',
        journalHint:
          'Jun’s pocket watch drifts in the morning mist—check in with Nora over the route ledger or ask Arthur at Copperwheel Cottage.',
        involvedResidents: ['jun'],
        unlockCondition: { flagsTrue: ['deliveredPostcard'] },
      },
      {
        stage: 2,
        title: 'Ledger & Escapement',
        journalHint:
          'Nora eased Jun’s schedule check—bring word to Arthur so he can oil the watch’s balance wheel.',
        involvedResidents: ['nora', 'jun'],
      },
      {
        stage: 3,
        title: 'Right to the Chime',
        journalHint:
          'Arthur’s steady watchmaker’s oil keeps Jun unhurried along every doorstep.',
        involvedResidents: ['arthur', 'jun'],
      },
    ],
    outcomes: {
      steady_route: {
        label: 'Punctual Morning Loop',
        journalSummary:
          'Arthur balanced the spring and Nora trimmed Jun’s spare ledger stops so mornings stay unhurried.',
      },
      patient_repair: {
        label: 'Tea & Balanced Escapement',
        journalSummary:
          'Arthur taught Jun to wind his watch gently over tea, easing old worries about missed mail.',
      },
    },
  },
  {
    id: 'conflict_plaza_lanterns',
    title: 'Lanterns Over Mirror Pond',
    subtitle: 'Balancing Barnaby’s warm pier lamps against Toby and Nora’s firefly dusk.',
    category: 'interconnected_conflict',
    leadResidents: ['toby', 'barnaby', 'nora', 'sora'],
    stages: [
      {
        stage: 1,
        title: 'Starlight vs. Pier Lamps',
        journalHint:
          'With festoon bulbs aglow, Barnaby wants bright work-lanterns down the pier too—hear out his plan at Pinecone Woodshop.',
        involvedResidents: ['toby', 'barnaby'],
        unlockCondition: { flagsTrue: ['lanternsLit'] },
      },
      {
        stage: 2,
        title: 'Overnight Lamp Trial',
        journalHint:
          'Barnaby and the square are letting the dusk test settle overnight—speak with Nora tomorrow once the evening trial finishes.',
        involvedResidents: ['barnaby', 'nora'],
      },
      {
        stage: 3,
        title: 'Shared Evening Glow',
        journalHint:
          'Neighbors settled how Willow Step Lane shares warm lantern light and quiet pond starlight together.',
        involvedResidents: ['nora', 'barnaby', 'toby', 'sora'],
      },
    ],
    outcomes: {
      bridge_compromise: {
        label: 'Hooded Amber Compromise',
        journalSummary:
          'Barnaby shaped downward brass hoods so footsteps stay bright while Mirror Pond stays shadowy for fireflies.',
      },
      gentle_space: {
        label: 'Bridgehead Sanctuary',
        journalSummary:
          'Neighbors left the pier unlit for dusk reflections and anchored warm guide lanterns cleanly at the cedar bridge.',
      },
      public_harmony: {
        label: 'Shared Dusk Candle Walk',
        journalSummary:
          'Barnaby, Toby, Nora, and Sora turned the disagreement into an unhurried evening lantern-and-music walk.',
      },
    },
  },
  {
    id: 'side_orchard_gathering',
    title: 'The Fern Hollow Orchard Gathering',
    subtitle: 'Rowan wants to welcome neighbors beneath the north boughs for honey and harvest treats.',
    category: 'personal_story',
    leadResidents: ['rowan', 'clara', 'mina'],
    stages: [
      {
        stage: 1,
        title: 'An Empty Table Under the Boughs',
        journalHint:
          'Rowan asked whether Clara has spiced crabapple pastry in mind—or if Mina prefers floral honeyed tea for the north orchard table.',
        involvedResidents: ['clara', 'mina'],
      },
      {
        stage: 2,
        title: 'Harvest & Blossoms Chosen',
        journalHint:
          'Return to Rowan at Fern Hollow Orchard to set out the tasting table and string up the evening lantern garlands.',
        involvedResidents: ['rowan'],
      },
      {
        stage: 3,
        title: 'Tasting Table Open',
        journalHint:
          'Rowan, Clara, and Mina hung marigold garlands above the cedar tasting table so neighbors gather regularly beneath the crabapple boughs.',
        involvedResidents: ['rowan', 'clara', 'mina'],
      },
    ],
    outcomes: {
      spiced_tart_table: {
        label: 'Spiced Crabapple Tart Table',
        journalSummary:
          'Clara glazed crisp Fern Hollow crabapples into warm spiced tarts served on stoneware platters beneath the lantern garlands.',
      },
      blossom_honey_picnic: {
        label: 'Chamomile-Honey Picnic',
        journalSummary:
          'Mina steeped chamomile and wild skep honey over stoneware teacups while afternoon breeze carried orchard petals across the table.',
      },
    },
  },
];

export const STORYLINE_MAP: Record<string, StorylineDefinition> = STORYLINES.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<string, StorylineDefinition>,
);

export function createInitialStorylines(): Record<string, StorylineProgress> {
  const out: Record<string, StorylineProgress> = {};
  for (const def of STORYLINES) {
    out[def.id] = {
      id: def.id,
      stage: 0,
      status: 'available',
    };
  }
  return out;
}

export function cloneStorylineProgress(entry: StorylineProgress): StorylineProgress {
  return {
    ...entry,
    ...(entry.notes ? { notes: [...entry.notes] } : {}),
  };
}

export function cloneStorylines(
  src?: Record<string, StorylineProgress>,
): Record<string, StorylineProgress> {
  const base = createInitialStorylines();
  if (!src) return base;
  for (const [id, entry] of Object.entries(src)) {
    if (!entry) continue;
    base[id] = cloneStorylineProgress(entry);
  }
  return base;
}

export function isStorylineOnCooldown(
  progress: StorylineProgress | undefined,
  currentDay: number,
): boolean {
  return (
    progress?.cooldownUntilDay !== undefined &&
    Number.isFinite(progress.cooldownUntilDay) &&
    currentDay < progress.cooldownUntilDay
  );
}

export function getStorylineProgress(
  world: Pick<WorldState, 'storylines'>,
  id: string,
): StorylineProgress {
  const existing = world.storylines?.[id];
  if (existing) return existing;
  return {
    id,
    stage: 0,
    status: 'available',
  };
}

export function hydrateStorylinesFromLegacyState(params: {
  flags: StoryFlags;
  sideFlags: Record<string, boolean | number | string>;
  day: number;
}): Record<string, StorylineProgress> {
  const { sideFlags, day } = params;
  const out = createInitialStorylines();
  const safeDay = Math.max(1, Math.floor(day));

  // 1. Pip & Nora's Willow Lane Zine
  if (sideFlags.pipZinePrinted) {
    out.side_pip_zine = {
      id: 'side_pip_zine',
      stage: 3,
      status: 'completed',
      outcome:
        typeof sideFlags.pipZineTheme === 'string' &&
        STORYLINE_MAP.side_pip_zine.outcomes[sideFlags.pipZineTheme]
          ? sideFlags.pipZineTheme
          : 'classic_edition',
      startedDay: safeDay,
      updatedDay: safeDay,
      completedDay: safeDay,
    };
  } else if (sideFlags.pipZineStarted) {
    const theme =
      typeof sideFlags.pipZineTheme === 'string' &&
      STORYLINE_MAP.side_pip_zine.outcomes[sideFlags.pipZineTheme]
        ? sideFlags.pipZineTheme
        : undefined;
    out.side_pip_zine = {
      id: 'side_pip_zine',
      stage: theme ? 2 : 1,
      status: 'active',
      ...(theme ? { outcome: theme } : {}),
      startedDay: safeDay,
      updatedDay: safeDay,
    };
  }

  // 2. Mina & Clara's Herb Loaf
  if (sideFlags.herbLoafShared) {
    out.side_herb_loaf = {
      id: 'side_herb_loaf',
      stage: 3,
      status: 'completed',
      outcome:
        typeof sideFlags.herbLoafStyle === 'string' &&
        STORYLINE_MAP.side_herb_loaf.outcomes[sideFlags.herbLoafStyle]
          ? sideFlags.herbLoafStyle
          : 'plaza_table',
      startedDay: safeDay,
      updatedDay: safeDay,
      completedDay: safeDay,
    };
  } else if (sideFlags.herbLoafStarted) {
    const style =
      typeof sideFlags.herbLoafStyle === 'string' &&
      STORYLINE_MAP.side_herb_loaf.outcomes[sideFlags.herbLoafStyle]
        ? sideFlags.herbLoafStyle
        : undefined;
    out.side_herb_loaf = {
      id: 'side_herb_loaf',
      stage: style ? 2 : 1,
      status: 'active',
      ...(style ? { outcome: style } : {}),
      startedDay: safeDay,
      updatedDay: safeDay,
    };
  }

  // 3. Sora & Barnaby's Cedar Music Stand
  if (sideFlags.pondStandBuilt) {
    out.side_pond_stand = {
      id: 'side_pond_stand',
      stage: 3,
      status: 'completed',
      outcome:
        typeof sideFlags.pondStandStyle === 'string' &&
        STORYLINE_MAP.side_pond_stand.outcomes[sideFlags.pondStandStyle]
          ? sideFlags.pondStandStyle
          : 'carved_clef',
      startedDay: safeDay,
      updatedDay: safeDay,
      completedDay: safeDay,
    };
  } else if (sideFlags.pondStandStarted) {
    const style =
      typeof sideFlags.pondStandStyle === 'string' &&
      STORYLINE_MAP.side_pond_stand.outcomes[sideFlags.pondStandStyle]
        ? sideFlags.pondStandStyle
        : undefined;
    out.side_pond_stand = {
      id: 'side_pond_stand',
      stage: style ? 2 : 1,
      status: 'active',
      ...(style ? { outcome: style } : {}),
      startedDay: safeDay,
      updatedDay: safeDay,
    };
  }

  // 4. Jun & Arthur's Pocket Watch
  if (sideFlags.watchTuneFinished) {
    out.side_jun_watch = {
      id: 'side_jun_watch',
      stage: 3,
      status: 'completed',
      outcome:
        typeof sideFlags.watchTuneStyle === 'string' &&
        STORYLINE_MAP.side_jun_watch.outcomes[sideFlags.watchTuneStyle]
          ? sideFlags.watchTuneStyle
          : 'steady_route',
      startedDay: safeDay,
      updatedDay: safeDay,
      completedDay: safeDay,
    };
  } else if (sideFlags.watchTuneStarted) {
    const style =
      typeof sideFlags.watchTuneStyle === 'string' &&
      STORYLINE_MAP.side_jun_watch.outcomes[sideFlags.watchTuneStyle]
        ? sideFlags.watchTuneStyle
        : undefined;
    out.side_jun_watch = {
      id: 'side_jun_watch',
      stage: style ? 2 : 1,
      status: 'active',
      ...(style ? { outcome: style } : {}),
      startedDay: safeDay,
      updatedDay: safeDay,
    };
  }

  // 5. Lanterns Over Mirror Pond (interconnected conflict)
  if (sideFlags.lanternConflictResolved) {
    out.conflict_plaza_lanterns = {
      id: 'conflict_plaza_lanterns',
      stage: 3,
      status: 'completed',
      outcome:
        typeof sideFlags.lanternConflictOutcome === 'string' &&
        STORYLINE_MAP.conflict_plaza_lanterns.outcomes[sideFlags.lanternConflictOutcome]
          ? sideFlags.lanternConflictOutcome
          : 'bridge_compromise',
      startedDay: safeDay,
      updatedDay: safeDay,
      completedDay: safeDay,
    };
  } else if (sideFlags.lanternConflictStarted) {
    out.conflict_plaza_lanterns = {
      id: 'conflict_plaza_lanterns',
      stage: 1,
      status: 'active',
      startedDay: safeDay,
      updatedDay: safeDay,
    };
  }

  // 6. Rowan, Clara & Mina's Fern Hollow Orchard Gathering
  if (sideFlags.orchardGatheringComplete) {
    out.side_orchard_gathering = {
      id: 'side_orchard_gathering',
      stage: 3,
      status: 'completed',
      outcome:
        typeof sideFlags.orchardGatheringOutcome === 'string' &&
        STORYLINE_MAP.side_orchard_gathering.outcomes[sideFlags.orchardGatheringOutcome]
          ? sideFlags.orchardGatheringOutcome
          : 'spiced_tart_table',
      startedDay: safeDay,
      updatedDay: safeDay,
      completedDay: safeDay,
    };
  } else if (sideFlags.orchardGatheringStarted) {
    const outcome =
      typeof sideFlags.orchardGatheringOutcome === 'string' &&
      STORYLINE_MAP.side_orchard_gathering.outcomes[sideFlags.orchardGatheringOutcome]
        ? sideFlags.orchardGatheringOutcome
        : undefined;
    out.side_orchard_gathering = {
      id: 'side_orchard_gathering',
      stage: outcome ? 2 : 1,
      status: 'active',
      ...(outcome ? { outcome } : {}),
      startedDay: safeDay,
      updatedDay: safeDay,
    };
  }

  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeStorylines(
  rawStorylines: unknown,
  fallbackParams: {
    flags: StoryFlags;
    sideFlags: Record<string, boolean | number | string>;
    day: number;
  },
  warnings?: string[],
): Record<string, StorylineProgress> {
  const hydrated = hydrateStorylinesFromLegacyState(fallbackParams);
  if (!isRecord(rawStorylines)) {
    return hydrated;
  }

  const out: Record<string, StorylineProgress> = { ...hydrated };

  for (const [key, rawEntry] of Object.entries(rawStorylines)) {
    if (!isRecord(rawEntry)) {
      warnings?.push(`discarded malformed storyline entry: ${key}`);
      continue;
    }

    const def = STORYLINE_MAP[key];
    const maxStage = def ? def.stages.length : 12;
    const baseEntry = hydrated[key] ?? {
      id: key,
      stage: 0,
      status: 'available' as StorylineStatus,
    };

    const rawStatus =
      typeof rawEntry.status === 'string' &&
      VALID_STORYLINE_STATUSES.has(rawEntry.status as StorylineStatus)
        ? (rawEntry.status as StorylineStatus)
        : baseEntry.status;

    const rawStageNum =
      typeof rawEntry.stage === 'number' && Number.isFinite(rawEntry.stage)
        ? Math.max(0, Math.min(maxStage, Math.floor(rawEntry.stage)))
        : baseEntry.stage;

    const resolvedStatus: StorylineStatus =
      baseEntry.status === 'completed'
        ? 'completed'
        : rawStatus === 'completed'
        ? 'completed'
        : rawStageNum > 0 && rawStatus === 'available'
        ? 'active'
        : rawStatus;

    const resolvedStage =
      resolvedStatus === 'completed'
        ? Math.max(rawStageNum, baseEntry.stage, def ? def.stages.length : rawStageNum)
        : Math.max(rawStageNum, baseEntry.stage);

    const outcome =
      typeof rawEntry.outcome === 'string' && rawEntry.outcome.length > 0
        ? rawEntry.outcome
        : baseEntry.outcome;

    const parseOptDay = (v: unknown, fb?: number): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.floor(v) : fb;

    const startedDay = parseOptDay(rawEntry.startedDay, baseEntry.startedDay);
    const updatedDay = parseOptDay(rawEntry.updatedDay, baseEntry.updatedDay);
    const completedDay =
      resolvedStatus === 'completed'
        ? parseOptDay(rawEntry.completedDay, baseEntry.completedDay ?? fallbackParams.day)
        : undefined;
    const cooldownUntilDay =
      resolvedStatus !== 'completed' ? parseOptDay(rawEntry.cooldownUntilDay) : undefined;

    const notes = Array.isArray(rawEntry.notes)
      ? rawEntry.notes
          .filter((n): n is string => typeof n === 'string' && n.length > 0)
          .slice(-MAX_STORYLINE_NOTES)
      : undefined;

    out[key] = {
      id: key,
      stage: resolvedStage,
      status: resolvedStatus,
      ...(outcome ? { outcome } : {}),
      ...(startedDay !== undefined ? { startedDay } : {}),
      ...(updatedDay !== undefined ? { updatedDay } : {}),
      ...(completedDay !== undefined ? { completedDay } : {}),
      ...(cooldownUntilDay !== undefined ? { cooldownUntilDay } : {}),
      ...(notes && notes.length > 0 ? { notes } : {}),
    };
  }

  return out;
}

export function syncSideFlagsFromStorylineInPlace(
  sideFlags: Record<string, boolean | number | string>,
  progress: StorylineProgress,
): void {
  const started = progress.stage >= 1 || progress.status === 'active' || progress.status === 'completed';
  const completed = progress.status === 'completed';

  switch (progress.id) {
    case 'side_pip_zine':
      if (started) sideFlags.pipZineStarted = true;
      if (completed) sideFlags.pipZinePrinted = true;
      if (progress.outcome) sideFlags.pipZineTheme = progress.outcome;
      break;
    case 'side_herb_loaf':
      if (started) sideFlags.herbLoafStarted = true;
      if (completed) sideFlags.herbLoafShared = true;
      if (progress.outcome) sideFlags.herbLoafStyle = progress.outcome;
      break;
    case 'side_pond_stand':
      if (started) sideFlags.pondStandStarted = true;
      if (completed) sideFlags.pondStandBuilt = true;
      if (progress.outcome) sideFlags.pondStandStyle = progress.outcome;
      break;
    case 'side_jun_watch':
      if (started) sideFlags.watchTuneStarted = true;
      if (completed) sideFlags.watchTuneFinished = true;
      if (progress.outcome) sideFlags.watchTuneStyle = progress.outcome;
      break;
    case 'conflict_plaza_lanterns':
      if (started) sideFlags.lanternConflictStarted = true;
      if (completed) sideFlags.lanternConflictResolved = true;
      if (progress.outcome) sideFlags.lanternConflictOutcome = progress.outcome;
      break;
    case 'side_orchard_gathering':
      if (started) sideFlags.orchardGatheringStarted = true;
      if (completed) sideFlags.orchardGatheringComplete = true;
      if (progress.outcome) sideFlags.orchardGatheringOutcome = progress.outcome;
      break;
    default:
      break;
  }
}

export function advanceStorylineInPlace(
  storylines: Record<string, StorylineProgress>,
  sideFlags: Record<string, boolean | number | string>,
  spec: StorylineAdvanceSpec,
  day: number,
): { updated: StorylineProgress; completedNow: boolean } {
  const def = STORYLINE_MAP[spec.id];
  const prev: StorylineProgress = storylines[spec.id]
    ? cloneStorylineProgress(storylines[spec.id])
    : { id: spec.id, stage: 0, status: 'available' };

  const wasCompleted = prev.status === 'completed';
  const maxStage = def ? def.stages.length : Math.max(prev.stage, spec.setStage ?? prev.stage);

  const nextStage =
    spec.setStage !== undefined
      ? Math.max(prev.stage, Math.min(maxStage, Math.floor(spec.setStage)))
      : prev.stage;

  let nextStatus: StorylineStatus = spec.setStatus ?? prev.status;
  if (wasCompleted) {
    nextStatus = 'completed';
  } else if (spec.setStatus === undefined && nextStage > 0 && nextStatus === 'available') {
    nextStatus = 'active';
  }

  const nextOutcome = spec.setOutcome ?? prev.outcome;
  const startedDay =
    prev.startedDay ?? (nextStage > 0 || nextStatus === 'active' || nextStatus === 'completed' ? day : undefined);
  const completedNow = !wasCompleted && nextStatus === 'completed';
  const completedDay =
    nextStatus === 'completed' ? prev.completedDay ?? day : undefined;

  let cooldownUntilDay = prev.cooldownUntilDay;
  if (nextStatus === 'completed') {
    cooldownUntilDay = undefined;
  } else if (spec.cooldownDays !== undefined) {
    cooldownUntilDay =
      spec.cooldownDays > 0 ? day + Math.floor(spec.cooldownDays) : undefined;
  }

  const notes = prev.notes ? [...prev.notes] : [];
  if (spec.note && !notes.includes(spec.note)) {
    notes.push(spec.note);
    if (notes.length > MAX_STORYLINE_NOTES) {
      notes.splice(0, notes.length - MAX_STORYLINE_NOTES);
    }
  }

  const updated: StorylineProgress = {
    id: spec.id,
    stage: nextStage,
    status: nextStatus,
    ...(nextOutcome ? { outcome: nextOutcome } : {}),
    ...(startedDay !== undefined ? { startedDay } : {}),
    updatedDay: day,
    ...(completedDay !== undefined ? { completedDay } : {}),
    ...(cooldownUntilDay !== undefined ? { cooldownUntilDay } : {}),
    ...(notes.length > 0 ? { notes } : {}),
  };

  storylines[spec.id] = updated;
  syncSideFlagsFromStorylineInPlace(sideFlags, updated);

  return { updated, completedNow };
}

export function getActiveStorylineCue(
  residentId: ResidentId,
  world: Pick<WorldState, 'storylines' | 'day'>,
): { storylineId: string; stage: number; title: string } | null {
  for (const def of STORYLINES) {
    const prog = getStorylineProgress(world, def.id);
    if (prog.status !== 'active') continue;
    if (isStorylineOnCooldown(prog, world.day)) continue;
    const nextStageDef = def.stages.find((s) => s.stage === prog.stage + 1);
    if (nextStageDef && nextStageDef.involvedResidents.includes(residentId)) {
      return {
        storylineId: def.id,
        stage: nextStageDef.stage,
        title: def.title,
      };
    }
  }
  return null;
}

export interface JournalStorylineProjection {
  id: string;
  title: string;
  subtitle: string;
  category: StorylineDefinition['category'];
  status: StorylineStatus;
  stage: number;
  totalStages: number;
  stageTitle: string;
  hintText: string;
  outcomeLabel?: string;
  involvedResidents: ResidentId[];
  cooldownUntilDay?: number;
  notes: string[];
}

export function projectStorylineForJournal(
  def: StorylineDefinition,
  progress: StorylineProgress,
): JournalStorylineProjection {
  const totalStages = def.stages.length;
  const currentStageDef =
    def.stages.find((s) => s.stage === progress.stage) ?? def.stages[0];
  const outcomeDef =
    progress.outcome && def.outcomes[progress.outcome]
      ? def.outcomes[progress.outcome]
      : undefined;

  return {
    id: def.id,
    title: def.title,
    subtitle: def.subtitle,
    category: def.category,
    status: progress.status,
    stage: progress.stage,
    totalStages,
    stageTitle:
      progress.status === 'completed' && outcomeDef
        ? outcomeDef.label
        : progress.stage === 0
        ? 'Ready to Begin'
        : currentStageDef?.title ?? def.title,
    hintText:
      progress.status === 'completed' && outcomeDef
        ? outcomeDef.journalSummary
        : currentStageDef?.journalHint ?? def.subtitle,
    ...(outcomeDef ? { outcomeLabel: outcomeDef.label } : {}),
    involvedResidents: def.leadResidents,
    ...(progress.cooldownUntilDay !== undefined
      ? { cooldownUntilDay: progress.cooldownUntilDay }
      : {}),
    notes: progress.notes ? [...progress.notes] : [],
  };
}
