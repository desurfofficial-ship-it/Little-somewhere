/**
 * Dialogue content module: POCKET_WATCH_ARC_TOPICS.
 *
 * Extracted verbatim from narrative.ts (Dialogue Modularization,
 * 2026-11). Topic ids, priorities, conditions, node graphs, text and
 * dynamic builders are byte-identical to the original inline array.
 * Selection/evaluation logic lives in ../dialogueEngine — this file is
 * content-only. Ordering contract: see ./index.ts (src/game/dialogue/).
 */
import {
  DialogueChoice, DialogueTopic,
} from '../../types';
import { DeclarativeNodeSpec, findSpeakerMemory, makeBranchingTopic, makeSimpleTopic } from '../../dialogueEngine';

export const POCKET_WATCH_ARC_TOPICS: readonly DialogueTopic[] = [
  // 4. True on the Route (Jun -> Nora -> Arthur, friction-aware!)
  makeSimpleTopic(
    'side_jun_watch_1',
    'jun',
    'personal_story',
    13,
    {
      requiresStoryline: { id: 'side_jun_watch', status: ['available'], maxStage: 0 },
      sideFlagsFalse: ['watchTuneStarted'],
      flagsTrue: ['deliveredPostcard'],
      notSeenToday: true,
    },
    {
      moodLabel: 'Curious',
      buildText: (_id, world) => {
        const bluntMem = findSpeakerMemory('jun', world, { tags: ['player_blunt'] });
        return bluntMem
          ? `Look—I’ve been triple-checking every mail strap since earlier. Truth is, my old brass pocket watch loses four minutes in the morning mist, which makes me rush the whole route.`
          : `Ever since my route expanded past Mirror Pond, my old brass pocket watch loses four minutes every misty morning—makes me rush the mailbox loop.`;
      },
      choices: [
        {
          id: 'jun_watch_arthur',
          label: 'Arthur could balance that escapement in two minutes—want me to ask?',
          tone: 'warm',
          nextNodeId: 'end_w1',
          trustDelta: 1,
          reliabilityDelta: 6,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { watchTuneStarted: true },
          advanceStoryline: {
            id: 'side_jun_watch',
            setStage: 1,
            setStatus: 'active',
            note: 'Jun admitted his brass watch drifts four minutes on misty mornings.',
          },
          adjustNpcRelations: [
            { a: 'arthur', b: 'jun', deltaAffinity: 4, deltaTension: 0, tag: 'watch_request' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_jun_watch_start',
              tag: 'watch_drift_shared',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['jun', 'arthur'],
            },
          ],
        },
      ],
      endings: {
        end_w1: {
          moodLabel: 'Relieved',
          text: `Would you? And maybe ask Nora if my Book Nook ledger drop can sit five minutes later while Arthur looks at the spring!`,
        },
      },
    },
  ),
  makeSimpleTopic(
    'side_nora_watch_check',
    'nora',
    'personal_story',
    19,
    {
      requiresStoryline: { id: 'side_jun_watch', status: ['active'], minStage: 1, maxStage: 1 },
      notSeenToday: true,
    },
    {
      moodLabel: 'Kind',
      buildText: () =>
        `Jun checks the Book Nook almanac stamps like a hawk, yet nobody here minds waiting five extra minutes for morning post. How should we ease his route pressure?`,
      choices: [
        {
          id: 'nora_trim_ledger_stops',
          label: 'Drop redundant bookshop check-in slips so his morning loop stays brisk.',
          tone: 'practical',
          nextNodeId: 'nora_ledger_end',
          trustDelta: 1,
          reliabilityDelta: 6,
          isStoryMilestone: true,
          setEmotion: 'happy',
          advanceStoryline: {
            id: 'side_jun_watch',
            setStage: 2,
            setStatus: 'active',
            setOutcome: 'steady_route',
            note: 'Nora trimmed redundant morning ledger stamps for Jun.',
          },
          adjustNpcRelations: [
            { a: 'jun', b: 'nora', deltaAffinity: 6, deltaTension: -3, tag: 'ledger_trimmed' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_nora_watch_ledger',
              tag: 'watch_ledger_trimmed',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['nora', 'jun'],
            },
          ],
        },
        {
          id: 'nora_teach_gentle_pace',
          label: 'Remind him neighbors welcome a tea-break pace—ask Arthur to teach him gentle winding.',
          tone: 'gentle',
          nextNodeId: 'nora_pace_end',
          trustDelta: 1,
          reliabilityDelta: 7,
          isStoryMilestone: true,
          setEmotion: 'relaxed',
          advanceStoryline: {
            id: 'side_jun_watch',
            setStage: 2,
            setStatus: 'active',
            setOutcome: 'patient_repair',
            note: 'Nora encouraged a gentler morning post rhythm with Arthur.',
          },
          adjustNpcRelations: [
            { a: 'jun', b: 'nora', deltaAffinity: 5, deltaTension: -2, tag: 'patient_route' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_nora_watch_pace',
              tag: 'watch_patient_pace',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['nora', 'jun'],
            },
          ],
        },
      ],
      endings: {
        nora_ledger_end: {
          moodLabel: 'Crisp',
          text: `Sorted—fewer slips means Jun can focus on real letters. Let Arthur balance the mainspring next.`,
        },
        nora_pace_end: {
          moodLabel: 'Fond',
          text: `Tell Arthur to pour two tea cups while he opens the watch case—Jun listens twice as well unhurried.`,
        },
      },
    },
  ),
  makeBranchingTopic(
    'side_arthur_watch_2',
    'arthur',
    'personal_story',
    16,
    {
      requiresStoryline: { id: 'side_jun_watch', status: ['active'], minStage: 1, maxStage: 2 },
      sideFlagsFalse: ['watchTuneFinished'],
      notSeenToday: true,
    },
    (_id, world): { nodes: Record<string, DeclarativeNodeSpec> } => {
      const prog = world.storylines?.side_jun_watch;
      const outcome =
        prog?.outcome === 'patient_repair' ? 'patient_repair' : 'steady_route';
      const rootText =
        prog?.stage === 2 && outcome === 'patient_repair'
          ? `Jun’s mail watch? Aye, Nora sent word—morning mist stiffens the mainspring oil, and the lad’s been over-winding out of worry. Let’s pour tea and balance it properly.`
          : `Jun’s mail watch? Aye, morning mist stiffens the mainspring oil. Hand it over—a drop of watchmaker’s oil and half a turn on the balance screw will keep him right to the chime.`;

      const choices: DialogueChoice[] = [
        {
          id: 'arthur_fix_watch',
          label:
            prog?.stage === 2 && outcome === 'patient_repair'
              ? 'Show Jun how gently a balanced escapement ticks over warm tea.'
              : 'Listen how clean that tick sounds already—thank you, Arthur.',
          tone: 'warm',
          nextNodeId: 'end_w2',
          trustDelta: 1,
          reliabilityDelta: 10,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { watchTuneFinished: true, watchTuneStyle: outcome },
          advanceStoryline: {
            id: 'side_jun_watch',
            setStage: 3,
            setStatus: 'completed',
            setOutcome: outcome,
            note: `Arthur balanced Jun’s pocket watch (${outcome}).`,
          },
          adjustNpcRelations: [
            { a: 'arthur', b: 'jun', deltaAffinity: 8, deltaTension: -4, tag: 'watch_tuned' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_jun_watch_tuned',
              tag: 'watch_tuned',
              category: 'event',
              valence: 'warm',
              importance: 4,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['arthur', 'jun'],
            },
            {
              target: 'jun',
              id: 'ev_jun_watch_tuned',
              tag: 'watch_tuned',
              category: 'event',
              valence: 'warm',
              importance: 4,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['arthur', 'jun'],
            },
          ],
          unlockMemory: {
            id: 'mem_side_jun_watch',
            title: 'True on the Route',
            summary:
              outcome === 'patient_repair'
                ? 'Arthur oiled Jun’s watch over tea and eased his rush along the morning mail loop.'
                : 'Arthur calibrated Jun’s courier pocket watch so the morning post never drifts behind schedule.',
            residentId: 'arthur',
          },
        },
      ];

      if ((prog?.stage ?? 1) < 2) {
        choices.push({
          id: 'arthur_tea_and_wind',
          label: 'Remind Jun he can wind slowly over tea—no neighbor minds two minutes.',
          tone: 'gentle',
          nextNodeId: 'end_w2_tea',
          trustDelta: 1,
          reliabilityDelta: 10,
          isStoryMilestone: true,
          setEmotion: 'relaxed',
          setSideFlags: { watchTuneFinished: true, watchTuneStyle: 'patient_repair' },
          advanceStoryline: {
            id: 'side_jun_watch',
            setStage: 3,
            setStatus: 'completed',
            setOutcome: 'patient_repair',
            note: 'Arthur taught Jun a calmer morning watch routine.',
          },
          adjustNpcRelations: [
            { a: 'arthur', b: 'jun', deltaAffinity: 9, deltaTension: -5, tag: 'watch_tuned' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_jun_watch_tuned',
              tag: 'watch_tuned',
              category: 'event',
              valence: 'warm',
              importance: 4,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['arthur', 'jun'],
            },
          ],
          unlockMemory: {
            id: 'mem_side_jun_watch',
            title: 'True on the Route',
            summary:
              'Arthur balanced Jun’s pocket watch and showed him how to wind it calmly before morning rounds.',
            residentId: 'arthur',
          },
        });
      }

      return {
        nodes: {
          root: {
            moodLabel: 'Focused',
            text: rootText,
            choices,
          },
          end_w2: {
            moodLabel: 'Warm',
            text: `A town runs gentler when its letter carrier trusts the hour.`,
          },
          end_w2_tea: {
            moodLabel: 'Gentle',
            text: `Never force a spring or a morning, I told him. Look how steady his shoulders sit already.`,
          },
        },
      };
    },
  ),
];
