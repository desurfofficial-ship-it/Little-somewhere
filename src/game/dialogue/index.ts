/**
 * Authoritative dialogue content aggregation point.
 *
 * DIALOGUE_TOPICS is concatenated from content modules in EXACTLY the
 * original narrative.ts array order (Dialogue Modularization,
 * 2026-11). Do not reorder the spreads: topic order is part of the
 * verified compatibility contract (see scripts/topic snapshots and
 * src/game/dialogueRegistry.test.ts).
 *
 * Ownership notes (actual content organization, which differs from the
 * blueprint's per-resident guess): personal storylines are sequential
 * multi-resident community arcs, so personal/ modules are arc-owned
 * files, not per-resident files. Copperwheel Cottage dialogue joined as
 * interiors/copperwheel.ts in Milestone 3 Build 9 (Arthur's workshop
 * invitation + daily check-in).
 */
import type { DialogueTopic } from '../types';
import { BELL_QUEST_TOPICS } from './quest/bellQuest';
import { CONFLICT_MEDIATION_TOPICS } from './quest/conflicts';
import { ZINE_ARC_TOPICS } from './personal/zineArc';
import { HERB_HEARTH_ARC_TOPICS } from './personal/herbHearthArc';
import { MUSIC_STAND_ARC_TOPICS } from './personal/musicStandArc';
import { POCKET_WATCH_ARC_TOPICS } from './personal/pocketWatchArc';
import { LANTERN_ARC_TOPICS } from './quest/lanternsArc';
import { STORYLINE_EPILOGUE_TOPICS } from './events/epilogues';
import { ORCHARD_ARC_TOPICS } from './personal/orchardArc';
import { ORCHARD_EPILOGUE_TOPICS } from './events/orchardEpilogue';
import { EVENT_CELEBRATION_TOPICS } from './events/celebrations';
import { GOSSIP_TOPICS } from './everyday/gossip';
import { RELATIONSHIP_TOPICS } from './everyday/relationships';
import { WEATHER_SEASON_TOPICS } from './everyday/weather';
import { DAILY_SLICE_TOPICS } from './everyday/smalltalk';
import { EVERYDAY_HOME_TOPICS } from './everyday/home';
import { GREENHOUSE_TOPICS } from './interiors/greenhouse';
import { BAKERY_TOPICS } from './interiors/bakery';
import { BOOK_NOOK_TOPICS } from './interiors/bookNook';
import { COPPERWHEEL_TOPICS } from './interiors/copperwheel';
import { WILDS_TOPICS } from './interiors/wilds';

export const DIALOGUE_TOPICS: readonly DialogueTopic[] = [
  ...BELL_QUEST_TOPICS, // 5 topics
  ...CONFLICT_MEDIATION_TOPICS, // 2 topics
  ...ZINE_ARC_TOPICS, // 4 topics
  ...HERB_HEARTH_ARC_TOPICS, // 3 topics
  ...MUSIC_STAND_ARC_TOPICS, // 3 topics
  ...POCKET_WATCH_ARC_TOPICS, // 3 topics
  ...LANTERN_ARC_TOPICS, // 3 topics
  ...STORYLINE_EPILOGUE_TOPICS, // 2 topics
  ...ORCHARD_ARC_TOPICS, // 4 topics
  ...ORCHARD_EPILOGUE_TOPICS, // 1 topic
  ...EVENT_CELEBRATION_TOPICS, // 3 topics
  ...GOSSIP_TOPICS, // 7 topics
  ...RELATIONSHIP_TOPICS, // 6 topics
  ...WEATHER_SEASON_TOPICS, // 2 topics
  ...DAILY_SLICE_TOPICS, // 18 topics
  ...EVERYDAY_HOME_TOPICS, // 5 topics
  ...GREENHOUSE_TOPICS, // 2 topics
  ...BAKERY_TOPICS, // 2 topics
  ...BOOK_NOOK_TOPICS, // 2 topics
  ...COPPERWHEEL_TOPICS, // 2 topics (Milestone 3 Build 9 — Copperwheel Cottage, Arthur)
  ...WILDS_TOPICS, // 2 topics (Build 10 — The Wild Hollows exploration check-ins)
];
