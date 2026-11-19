/**
 * Dialogue content module: ZINE_ARC_TOPICS.
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
import { RESIDENTS } from '../../residents';

export const ZINE_ARC_TOPICS: readonly DialogueTopic[] = [
  // ================= 4 PERSONAL MULTI-STAGE STORYLINES =================
  // 1. Willow Lane Zine (Pip -> Toby/Clara -> Nora)
  makeSimpleTopic(
    'side_pip_zine_1',
    'pip',
    'personal_story',
    15,
    {
      requiresStoryline: { id: 'side_pip_zine', status: ['available'], maxStage: 0 },
      sideFlagsFalse: ['pipZineStarted'],
      minTrust: 1,
      notSeenToday: true,
    },
    {
      moodLabel: 'Excited',
      buildText: () =>
        `I’ve been sketching every stray marmalade cat paw-print onto notebook scraps—Miss Nora says if I collect three stories, she’ll bind them into a Willow Lane Zine!`,
      choices: [
        {
          id: 'pip_zine_start_choice',
          label: 'Count me in! What else should go in the first Willow Lane Zine?',
          tone: 'warm',
          nextNodeId: 'end_yes',
          trustDelta: 1,
          reliabilityDelta: 8,
          isStoryMilestone: true,
          setEmotion: 'excited',
          setSideFlags: { pipZineStarted: true },
          advanceStoryline: {
            id: 'side_pip_zine',
            setStage: 1,
            setStatus: 'active',
            note: 'Pip started gathering chalk sketches and neighborhood stories for Issue #1.',
          },
          adjustNpcRelations: [
            { a: 'nora', b: 'pip', deltaAffinity: 4, deltaTension: 0, tag: 'zine_planning' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_pip_zine_start',
              tag: 'zine_started',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['pip', 'nora'],
            },
          ],
        },
      ],
      endings: {
        end_yes: {
          moodLabel: 'Beaming',
          text: `Really?! Tell Miss Nora I picked her favorite marigold leaf for the cover—or maybe ask Toby or Clara if they want a guest page!`,
        },
      },
    },
  ),
  makeSimpleTopic(
    'side_toby_zine_art',
    'toby',
    'personal_story',
    19,
    {
      requiresStoryline: { id: 'side_pip_zine', status: ['active'], minStage: 1, maxStage: 1 },
      notSeenToday: true,
    },
    {
      moodLabel: 'Curious',
      buildText: () =>
        `Pip stopped by asking if I ever drew the koi under Mirror Pond’s lantern reflection… I’ve actually got two clean watercolor sheets drying right here.`,
      choices: [
        {
          id: 'toby_zine_watercolor',
          label: 'Include Toby’s pond-and-lantern watercolors in Issue #1.',
          tone: 'warm',
          nextNodeId: 'toby_art_yes',
          trustDelta: 1,
          reliabilityDelta: 7,
          isStoryMilestone: true,
          setEmotion: 'happy',
          advanceStoryline: {
            id: 'side_pip_zine',
            setStage: 2,
            setStatus: 'active',
            setOutcome: 'art_edition',
            note: 'Toby offered Mirror Pond watercolor spreads for Issue #1.',
          },
          adjustNpcRelations: [
            { a: 'pip', b: 'toby', deltaAffinity: 6, deltaTension: 0, tag: 'zine_art' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_toby_zine_art',
              tag: 'zine_contributor_art',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['toby', 'pip'],
            },
          ],
        },
        {
          id: 'toby_zine_save_later',
          label: 'Let’s keep your watercolors for Issue #2—we might try a kitchen page first.',
          tone: 'gentle',
          nextNodeId: 'toby_art_wait',
          trustDelta: 0,
          setEmotion: 'relaxed',
        },
      ],
      endings: {
        toby_art_yes: {
          moodLabel: 'Shy-Proud',
          text: `Whoa, really?! Tell Miss Nora I’ll slip the painted carp folio onto the Linden counter before dusk.`,
        },
        toby_art_wait: {
          moodLabel: 'Understanding',
          text: `No rush—I’ll keep adding lily-pad details until Pip’s second issue comes around.`,
        },
      },
    },
  ),
  makeSimpleTopic(
    'side_clara_zine_kitchen',
    'clara',
    'personal_story',
    19,
    {
      requiresStoryline: { id: 'side_pip_zine', status: ['active'], minStage: 1, maxStage: 1 },
      notSeenToday: true,
    },
    {
      moodLabel: 'Fond',
      buildText: () =>
        `Pip’s little pocket zine sounds dear. I scribbled my hearth-steamed rosemary crust timing on an index card—think Nora would tuck a baking corner inside Issue #1?`,
      choices: [
        {
          id: 'clara_zine_recipe',
          label: 'Add Clara’s rosemary crust notes as the Hearth & Recipe feature.',
          tone: 'warm',
          nextNodeId: 'clara_rec_yes',
          trustDelta: 1,
          reliabilityDelta: 7,
          isStoryMilestone: true,
          setEmotion: 'happy',
          advanceStoryline: {
            id: 'side_pip_zine',
            setStage: 2,
            setStatus: 'active',
            setOutcome: 'kitchen_edition',
            note: 'Clara contributed her hearth sourdough notes for Issue #1.',
          },
          adjustNpcRelations: [
            { a: 'clara', b: 'pip', deltaAffinity: 6, deltaTension: 0, tag: 'zine_recipe' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_clara_zine_recipe',
              tag: 'zine_contributor_recipe',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['clara', 'pip'],
            },
          ],
        },
        {
          id: 'clara_zine_skip',
          label: 'Save your recipe card for next month—maybe Toby has a sketch for #1.',
          tone: 'gentle',
          nextNodeId: 'clara_rec_wait',
          trustDelta: 0,
          setEmotion: 'relaxed',
        },
      ],
      endings: {
        clara_rec_yes: {
          moodLabel: 'Warm',
          text: `Tuck it right beside Pip’s chalk stars! Nothing binds a neighborhood like crumbs and ink together.`,
        },
        clara_rec_wait: {
          moodLabel: 'Cheerful',
          text: `Fair enough—I’ll pin it above the flour bin until Issue #2!`,
        },
      },
    },
  ),
  makeBranchingTopic(
    'side_nora_zine_2',
    'nora',
    'personal_story',
    18,
    {
      requiresStoryline: { id: 'side_pip_zine', status: ['active'], minStage: 1, maxStage: 2 },
      sideFlagsFalse: ['pipZinePrinted'],
      notSeenToday: true,
    },
    (_id, world): { nodes: Record<string, DeclarativeNodeSpec> } => {
      const prog = world.storylines?.side_pip_zine;
      const outcome =
        prog?.outcome === 'art_edition' || prog?.outcome === 'kitchen_edition'
          ? prog.outcome
          : 'classic_edition';
      const contributorMem = findSpeakerMemory('nora', world, {
        tags: ['zine_contributor_art', 'zine_contributor_recipe'],
      });
      const heardPrefix = contributorMem?.fromResidentId
        ? `${RESIDENTS[contributorMem.fromResidentId].name} already dropped word—`
        : '';

      const rootText =
        outcome === 'art_edition'
          ? `${heardPrefix}Toby’s koi-and-lantern watercolor spread pairs beautifully with Pip’s chalk drawings. Shall we stitch the Pond & Lantern Art Edition onto the shelf?`
          : outcome === 'kitchen_edition'
          ? `${heardPrefix}Clara’s rosemary-crust recipe card smells faintly of flour beside Pip’s chalk doodles. Ready to bind the Hearth & Recipe Edition for the counter?`
          : `Pip arrived with six chalk drawings of the fountain carp and a dandelion bookmark. If you think the lane’s ready for a pocket edition, I’ve stitched the spine.`;

      const stageChoices: DialogueChoice[] = [
        {
          id: 'nora_print_zine',
          label:
            outcome === 'art_edition'
              ? 'Bind the Pond & Lantern Art Edition for the Book Nook counter!'
              : outcome === 'kitchen_edition'
              ? 'Bind the Hearth & Recipe Edition for the Book Nook counter!'
              : 'Let’s place Issue #1 on the Linden Book Nook counter!',
          tone: 'warm',
          nextNodeId: 'end_print',
          trustDelta: 1,
          reliabilityDelta: 10,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { pipZinePrinted: true, pipZineTheme: outcome },
          advanceStoryline: {
            id: 'side_pip_zine',
            setStage: 3,
            setStatus: 'completed',
            setOutcome: outcome,
            note: `Bound Issue #1 (${outcome}).`,
          },
          adjustNpcRelations: [
            { a: 'nora', b: 'pip', deltaAffinity: 8, deltaTension: 0, tag: 'zine_published' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_zine_published',
              tag: 'zine_published',
              category: 'event',
              valence: 'warm',
              importance: 4,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['nora', 'pip'],
            },
            {
              target: 'pip',
              id: 'ev_zine_published',
              tag: 'zine_published',
              category: 'event',
              valence: 'warm',
              importance: 4,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['nora', 'pip'],
            },
          ],
          unlockMemory: {
            id: 'mem_side_chalk_zine',
            title: 'Willow Lane Zine, Issue #1',
            summary:
              outcome === 'art_edition'
                ? 'Bound Pip’s chalk tales alongside Toby’s Mirror Pond watercolors for the neighborhood’s first storybook zine.'
                : outcome === 'kitchen_edition'
                ? 'Bound Pip’s chalk tales with Clara’s rosemary crust notes into the neighborhood’s first pocket zine.'
                : 'Helped Pip and Nora stitch together the neighborhood’s first pocket storybook zine.',
            residentId: 'nora',
          },
        },
      ];

      if ((prog?.stage ?? 1) < 2) {
        stageChoices.push({
          id: 'nora_wait_guest_page',
          label: 'Wait a beat—let’s ask Toby or Clara if they have a guest page first.',
          tone: 'curious',
          nextNodeId: 'wait_guest',
          trustDelta: 0,
          setEmotion: 'curious',
        });
      }

      return {
        nodes: {
          root: {
            moodLabel: 'Amused',
            text: rootText,
            choices: stageChoices,
          },
          end_print: {
            moodLabel: 'Proud',
            text: `Every little lane deserves its own chronicler—thank you for cheering Pip on.`,
          },
          wait_guest: {
            moodLabel: 'Attentive',
            text: `Good instinct. Toby keeps fresh watercolors by the pond, and Clara always has recipe scraps by her oven.`,
          },
        },
      };
    },
  ),
];
