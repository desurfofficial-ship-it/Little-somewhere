/**
 * Dialogue content module: DAILY_SLICE_TOPICS.
 *
 * Extracted verbatim from narrative.ts (Dialogue Modularization,
 * 2026-11). Topic ids, priorities, conditions, node graphs, text and
 * dynamic builders are byte-identical to the original inline array.
 * Selection/evaluation logic lives in ../dialogueEngine — this file is
 * content-only. Ordering contract: see ./index.ts (src/game/dialogue/).
 */
import {
  DialogueTopic,
} from '../../types';
import { makeSimpleTopic, resolveRelationshipGreeting } from '../../dialogueEngine';

export const DAILY_SLICE_TOPICS: readonly DialogueTopic[] = [
  // ================= RESIDENT DAILY SLICE POOL (MULTIPLE UNIQUE CHATS PER RESIDENT) =================
  // Clara
  makeSimpleTopic('daily_clara_crust', 'clara', 'daily_slice', 2, {}, {
    moodLabel: 'Warm',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} First score on a sourdough boule makes the whole porch smell like toasted hazelnuts.`,
    choices: [
      { id: 'clara_d1', label: 'Any secret to getting that crisp blistered crust?', tone: 'curious', nextNodeId: 'd1_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { d1_e: { moodLabel: 'Cheerful', text: `Steam in the first ten minutes, patience in the last twenty!` } },
  }),
  makeSimpleTopic('daily_clara_tables', 'clara', 'daily_slice', 2, {}, {
    moodLabel: 'Radiant',
    buildText: (_id, w) => w.flags.claraArthurReconciled
      ? `Arthur even fixed the bakery’s wall clock while the loaves were rising! Never thought the square could taste this bright again.`
      : `I still set an extra napkin on the café counter out of sheer habit.`,
    choices: [
      { id: 'clara_hug', label: 'The whole lane feels lighter with warm bread in the square.', tone: 'warm', nextNodeId: 'd2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { d2_e: { moodLabel: 'Grateful', text: `Bread is better when benches nearby have friends sitting on them.` } },
  }),

  // Arthur
  makeSimpleTopic('daily_arthur_springs', 'arthur', 'daily_slice', 2, {}, {
    moodLabel: 'Thoughtful',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Brass escapements keep honest time if you never force a stiff gear.`,
    choices: [
      { id: 'arthur_d1', label: 'Sounds a lot like mending friendships too.', tone: 'gentle', nextNodeId: 'a1_e', trustDelta: 1, setEmotion: 'relaxed' },
    ],
    endings: { a1_e: { moodLabel: 'Warm', text: `Hah… perhaps you know more clockwork than you let on.` } },
  }),
  makeSimpleTopic('daily_arthur_peace', 'arthur', 'daily_slice', 3, { flagsTrue: ['bellRestored'] }, {
    moodLabel: 'At Peace',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Hear how steady the bell’s echo sits against the hills? Clara even brought rosemary butter to the workshop.`,
    choices: [
      { id: 'arthur_ring_note', label: 'You built something that brings everyone together.', tone: 'warm', nextNodeId: 'a2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { a2_e: { moodLabel: 'Warm', text: `I only wound the spring, neighbor. You reminded the whole lane why it mattered.` } },
  }),

  // Mina
  makeSimpleTopic('daily_mina_soil', 'mina', 'daily_slice', 2, {}, {
    moodLabel: 'Gentle',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Rain-soaked terracotta and morning sun—plants never rush, yet they always arrive right on season.`,
    choices: [
      { id: 'mina_d1', label: 'Which blooms love the fountain mist best?', tone: 'curious', nextNodeId: 'm1_e', trustDelta: 1, setEmotion: 'curious' },
    ],
    endings: { m1_e: { moodLabel: 'Bright', text: `Sweet ferns and pale bluebell sprigs—they practically lean toward the splash.` } },
  }),
  makeSimpleTopic('daily_mina_chamomile', 'mina', 'daily_slice', 2, {}, {
    moodLabel: 'Warm',
    buildText: () => `I bundle spare chamomile blossoms every Tuesday for Sora’s tea cart so the steam smells like warm summer meadows.`,
    choices: [
      { id: 'mina_tea', label: 'Do you grow herbs for anyone else along the lane?', tone: 'curious', nextNodeId: 'm2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { m2_e: { moodLabel: 'Warm', text: `Rosemary for Clara, pressed lavender for Nora’s bookmarks—a little leaf for everyone!` } },
  }),

  // Jun
  makeSimpleTopic('daily_jun_route', 'jun', 'daily_slice', 2, {}, {
    moodLabel: 'Cheerful',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} I’ve already walked the cobblestone loop twice today. Checked your Willow Mailbox lately?`,
    choices: [
      { id: 'jun_gossip', label: 'Who seems most in need of company today?', tone: 'curious', nextNodeId: 'j1_e', trustDelta: 1, setEmotion: 'happy' },
      { id: 'jun_lanterns', label: 'Think we should light the plaza festoon lanterns tonight?', tone: 'warm', nextNodeId: 'j2_e', setFlags: { lanternsLit: true }, trustDelta: 1, isStoryMilestone: true },
    ],
    endings: {
      j1_e: { moodLabel: 'Observant', text: `Arthur lingers near the gazebo at sunset pretending to adjust his watch, and Clara leaves one extra loaf wrapped in linen.` },
      j2_e: { moodLabel: 'Bright', text: `Oh, I’ve been waiting for someone to say that! I’ll switch on the warm string lanterns along the plaza eaves.` },
    },
  }),
  makeSimpleTopic('daily_jun_stamps', 'jun', 'daily_slice', 2, {}, {
    moodLabel: 'Upbeat',
    buildText: () => `My favorite stamp in the ledger has two tiny swallows over a copper weathervane—folks always smile when that envelope shows up.`,
    choices: [
      { id: 'jun_d2', label: 'Sounds like carrying good news never gets old.', tone: 'warm', nextNodeId: 'j3_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { j3_e: { moodLabel: 'Cheerful', text: `Not once! Even bills look gentler when delivered with a wave.` } },
  }),

  // Barnaby
  makeSimpleTopic('daily_barnaby_craft', 'barnaby', 'daily_slice', 2, {}, {
    moodLabel: 'Sturdy',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Cedar joints don’t creak if you respect the grain. Say, you’re settling into Willow Step Cottage nicely.`,
    choices: [
      { id: 'barnaby_craft', label: 'Tell me about building the cottage porches here.', tone: 'warm', nextNodeId: 'b1_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { b1_e: { moodLabel: 'Fond', text: `Every porch faces the lane so folks see each other pass by. Even when folks get quiet, they’re still under the same sky.` } },
  }),
  makeSimpleTopic('daily_barnaby_benches', 'barnaby', 'daily_slice', 2, {}, {
    moodLabel: 'Relaxed',
    buildText: () => `Planed four cedar plaza benches three springs ago—sit down on any of them whenever your boots start aching!`,
    choices: [
      { id: 'barnaby_d2', label: 'Your joinery holds up through every season cleanly.', tone: 'warm', nextNodeId: 'b2_e', trustDelta: 1, setEmotion: 'relaxed' },
      // Preserved across both Barnaby daily topics so anti-repeat rotation never drops barnaby_craft (DUP-02).
      { id: 'barnaby_craft', label: 'Tell me about building the cottage porches here.', tone: 'warm', nextNodeId: 'b2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { b2_e: { moodLabel: 'Proud', text: `Hah! Heartwood cedar and oak pegs—built to outlast three generations of storytellers.` } },
  }),

  // Sora
  makeSimpleTopic('daily_sora_chord', 'sora', 'daily_slice', 2, {}, {
    moodLabel: 'Dreamy',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Whenever I tune my violin here, I listen to how stone and pond water carry the harmonics.`,
    choices: [
      { id: 'sora_song', label: 'Play a little piece while we watch the plaza.', tone: 'gentle', nextNodeId: 's1_e', trustDelta: 1, setEmotion: 'relaxed' },
    ],
    endings: { s1_e: { moodLabel: 'Peaceful', text: `Close your eyes for a beat. Even the breeze through the cedar eaves keeps steady time.` } },
  }),
  makeSimpleTopic('daily_sora_tea', 'sora', 'daily_slice', 2, {}, {
    moodLabel: 'Warm',
    buildText: () => `Steeping roasted pear with chamomile takes twice as long as black tea, yet nobody ever wishes it hurried.`,
    choices: [
      { id: 'sora_d2', label: 'Which bench catches the sweetest evening echo?', tone: 'curious', nextNodeId: 's2_e', trustDelta: 1, setEmotion: 'curious' },
    ],
    endings: { s2_e: { moodLabel: 'Serene', text: `The South Mirror Pond bench—notes skim right across the lilypads cleanly.` } },
  }),

  // Toby
  makeSimpleTopic('daily_toby_sketch', 'toby', 'daily_slice', 2, {}, {
    moodLabel: 'Shy',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Look how long afternoon shadows stretch across the bridge planks around golden hour.`,
    choices: [
      { id: 'toby_sketch', label: 'Can I peek at what you’re sketching?', tone: 'curious', nextNodeId: 't1_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { t1_e: { moodLabel: 'Shy-Warm', text: `Mostly the stray marmalade cat and ripples under the wooden bridge. Sit beside me anytime.` } },
  }),
  makeSimpleTopic('daily_toby_charcoal', 'toby', 'daily_slice', 2, {}, {
    moodLabel: 'Curious',
    buildText: () => `Soft willow charcoal smudges everywhere on my sleeves, yet nothing captures wet cobblestones quite as gently.`,
    choices: [
      { id: 'toby_d2', label: 'If I spot stray pastel chalks I’ll drop them by!', tone: 'warm', nextNodeId: 't2_e', trustDelta: 1, setEmotion: 'excited' },
    ],
    endings: { t2_e: { moodLabel: 'Grateful', text: `Whoa—really?! Pale amber chalk would make lantern halos glow off the page!` } },
  }),

  // Nora
  makeSimpleTopic('daily_nora_lanterns', 'nora', 'daily_slice', 2, { flagsTrue: ['foundPostcard'] }, {
    moodLabel: 'Attentive',
    buildText: (_id, w) => w.flags.claraArthurReconciled
      ? `The marigold ribbon is tied to the gazebo rail now. Notice how much brighter the square feels?`
      : `Every quiet lane needs someone willing to listen without rushing. You have a knack for that.`,
    choices: [
      { id: 'nora_tea_chat', label: 'How do you keep hope during quiet seasons?', tone: 'gentle', nextNodeId: 'n1_e', trustDelta: 1, setEmotion: 'relaxed' },
    ],
    endings: { n1_e: { moodLabel: 'Warm', text: `By leaving the porch light on even when nobody is walking down the lane yet.` } },
  }),
  makeSimpleTopic('daily_nora_margins', 'nora', 'daily_slice', 2, {}, {
    moodLabel: 'Wry',
    buildText: () => `Folks donate old paperbacks with bus tickets and pressed clovers tucked inside—like reading two stories at once.`,
    choices: [
      { id: 'nora_d2', label: 'Which shelf should a newcomer browse first?', tone: 'curious', nextNodeId: 'n2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { n2_e: { moodLabel: 'Fond', text: `Bottom oak shelf by the window—nothing but cozy maps and autumn recipes.` } },
  }),

  // Pip
  makeSimpleTopic('daily_pip_carp', 'pip', 'daily_slice', 2, { flagsTrue: ['heardBellMystery'] }, {
    moodLabel: 'Hopeful',
    buildText: (id, w, p) => w.flags.bellRestored
      ? `Did you hear that?! The brass bell echoed all the way to Mirror Pond! Even the carp jumped!`
      : `${resolveRelationshipGreeting(id, w, p)} Have you checked the hollow oak by Mirror Pond yet, or asked Barnaby about his tall cedar ladder?`,
    choices: [
      { id: 'pip_skip', label: 'Practice skipping a pebble on Mirror Pond with me later!', tone: 'warm', nextNodeId: 'p1_e', trustDelta: 1, setEmotion: 'excited' },
    ],
    endings: { p1_e: { moodLabel: 'Cheerful', text: `Deal! My record is four skips without splashing a single lilypad.` } },
  }),
  makeSimpleTopic('daily_pip_cinnamon', 'pip', 'daily_slice', 2, { flagsTrue: ['heardBellMystery'] }, {
    moodLabel: 'Eager',
    buildText: () => `Clara lets me eat cinnamon loaf heels on the bakery stoop whenever I sweep pine needles off the boardwalk!`,
    choices: [
      { id: 'pip_d2', label: 'Trade chalk star drawings for warm cinnamon buns?', tone: 'curious', nextNodeId: 'p2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { p2_e: { moodLabel: 'Beaming', text: `Best trade deal in Willow Lane history!` } },
  }),
];
