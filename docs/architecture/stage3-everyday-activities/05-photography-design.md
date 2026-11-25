# Photography — Stage 3 Continuation Design Specification

**Status:** Authoritative design for the Photography everyday activity.
**Template:** `src/game/fishing.ts` (the shipped Stage 3 vertical slice).
**Persistence:** Zero schema bump (WorldState stays v12) — rides `sideFlags` + `memories` + `inventory` + `npcMemories`.

## Core identity
Photography is a quiet, **discovery-driven** everyday activity. The player notices something memorable, frames it, captures it. It rewards **noticing**, not collecting. No daily limit, no quota, no quality scoring, nothing missable-forever.

## Core interaction
- The player carries a **camera** (a personal tool, like the journal), always available outdoors. NOT prop-gated.
- **Enter:** HUD Camera button or `[F]`. Movement is NOT paused (the player positions themselves to frame). A viewfinder overlay opens.
- **Capture:** tap a subject in the viewfinder list → `performPhotoAction(world, subjectId)`.
- **Exit:** `X`, `Escape`, or `[F]` again.

## Subject registry — finite, curated (13 subjects)
`PHOTO_SUBJECTS: readonly PhotoSubjectDef[]`. Each: `{ id, name, category, anchorX, anchorZ, frameRadius, memoryTitle, memorySummary, imageKey? }`. Categories: `landmark | community | water | scenery`. Anchors mirror `worldMap.PROP_INTERACTABLES` positions. Subjects: gazebo_bell, mirror_pond, hollow_oak, rise_vista, old_stone_well, plaza_noticeboard, plaza_garlands, orchard_lanterns, pond_mosaic, willow_jetty, west_brook_bank, marigold_bank, orchard_skep.

## Reducer — `performPhotoAction(world, subjectId): PhotoActionResult`
Pure, headless (zero DOM/three imports). Mirrors `fishing.ts` discipline:
- Guards: known subject (fail-closed), exterior only, no `activeActivity`. **No day-gate, no RNG, zero time cost** (anti-grind).
- First-of-subject: prepend `mem_photo_first_<subjectId>` journal memory (dedup by id). `memoryUnlockedTitle` only on true firsts.
- First-ever photo (photoCount 0→1): grant `framed_photo_keepsake` (idempotent `getItemCount === 0` guard, via `addItemToInventory`).
- Always: bump `sideFlags.photoCount`, stamp `sideFlags.photoLastDay = world.day`.
- Witness NPC memories: `collectWitnessesForPosition(world, world.playerPos, LOCAL_WITNESS_RADIUS)`, tag `'photo'`, `sourceKind: 'witness'`, `retention: 'ephemeral'`, `importance: 2`, `valence: 'warm'`, `emotionalWeight: 48`, `detail.placeName = subject.name`, eventId `ev_photo_<day>_<photoCount>`.
- Returns `{ nextWorld, title: 'Camera', body, memoryUnlockedTitle?, gainedItems?, subjectId?, subjectImageKey? }`.

## sideFlags keys
`PHOTO_COUNT_KEY = 'photoCount'`, `PHOTO_LAST_DAY_KEY = 'photoLastDay'`. `readCounter` helper (NaN-safe, same as fishing).

## Keepsake
`FRAMED_PHOTO_KEEPSAKE_ID = 'framed_photo_keepsake' as PersonalItemId` (SC-B cast). Registered in `inventory.ts` PERSONAL_ITEMS: `{ id, label: 'Framed First Photograph', category: 'keepsake', homeDisplayable: 'shelf', giftable: false }`. Subject scene in `dialogue/assets.ts` ITEM_SUBJECT_SPECS: `['framed_photo_keepsake' as PersonalItemId]: { subject: 'item_watercolor_card', primary: '#C9A253', accent: '#7FB5C4' }`.

## Everyday practice (`everyday.ts`)
Add `'photography'` to `EverydayPracticeId` + `EVERYDAY_PRACTICE_ORDER` (after `'community'`). `PHOTOGRAPHY_TIERS`: 0 Unframed / 1 First Frame / 3 Quiet Observer / 6 Noticer of Small Things / 10 Keeper of the Lane's Light. `PRACTICE_DEFS.photography.readCount = (world) => safeCounter(world.sideFlags?.photoCount)`. `deriveTouchedToday`: add `'photography'` when `isDoneToday(Number(world.sideFlags?.photoLastDay), day)`.

## Dialogue echoes (`dialogue/everyday/photoEcho.ts`)
`PHOTO_ECHO_TOPICS: readonly DialogueTopic[]` — 2 topics, appended at the END of `DIALOGUE_TOPICS` (after `COMMUNITY_ECHO_TOPICS`):
1. `everyday_photo_witness_echo` — `makeSimpleTopic(id, 'any', 'event_reaction', 12, { requiresNpcMemory: { tags: ['photo'], unmentionedOnly: true, maxDaysOld: 6, subjectPlayer: true }, notSeenToday: true }, { moodLabel: 'Warm', buildText: uses findSpeakerMemory + mem.detail?.placeName, choices: [{ id: 'ev_photo_witness_warm', markMemoryTagsMentioned: ['photo'], trustDelta: 1, ... }], endings })`. Tag is `'photo'` (not `'shared_photo'`) → no SF-4 boost → stays gentle below community band.
2. `everyday_photo_noticer` — priority 8, `requiresNpcMemory { tags: ['photo'], unmentionedOnly: false, maxDaysOld: 6 }`, `notSeenToday: true`, `maxSeenCount: 2`. No `markMemoryTagsMentioned`.

Append in `dialogue/index.ts`: `import { PHOTO_ECHO_TOPICS } from './everyday/photoEcho';` + `...PHOTO_ECHO_TOPICS,` after `...COMMUNITY_ECHO_TOPICS,`. Regenerate golden: `npx tsx scripts/generate_dialogue_golden.ts` (93 → 95).

## Frontend (`components/PhotoPanel.tsx`)
`PhotoPanelMode = null | 'viewfinder' | 'album'`. Props: `{ mode, world, playerPos, onClose, onCapture(subjectId), onSwitchMode(mode) }`. Viewfinder lists subjects within `frameRadius` of `playerPos` (sorted by distance), each with a Capture button; captured subjects (those with `mem_photo_first_<id>` memory) show a 'Kept' badge. Album: grid of captured subjects. Reuses `CommunityProjectsPanel` ownership discipline (panel holds no world state). `useDialogA11y`. Mobile-first (≥44px touch targets).

## App.tsx wiring
- Import `Camera` from lucide-react; `PhotoPanel, PhotoPanelMode`; `performPhotoAction`.
- State: `const [photoMode, setPhotoMode] = useState<PhotoPanelMode>(null);`.
- `handleCapturePhoto` callback (mirrors `handleCookRecipe`): `performPhotoAction(worldRef.current, subjectId)` → commitWorld → memory chime + toast → `setPropCard`-style feedback via toast.
- HUD Camera button (after Journal button): toggles photoMode; checks `playerLocation === 'exterior'` (toast if indoors).
- Keyboard `[F]`: toggle camera (protected-surface discipline — never stacks over dialogue/prop/panel).
- Escape/KeyP unwind: add `if (photoMode) { setPhotoMode(null); return; }` after `communityProjectsOpen`.
- KeyJ/KeyI: add `setPhotoMode(null);`. KeyE/KeyG guards: add `!photoMode`.
- Render `<PhotoPanel>` after `<CommunityProjectsPanel>`.

## Cottage shelf (framed-photo display)
The `framed_photo_keepsake` toggles onto the shelf via the existing `toggleDisplayedKeepsakeAction`. A dedicated framed-photo mesh group renders it. (This campaign ALSO evolves the shelf to a unified extensible mapping — see the shelf architecture work.)

## Tests
- `src/game/photography.test.ts`: 18 adversarial tests (PHOTO-01..18) mirroring fishing.test.ts — valid capture, first-ever keepsake, repeat subject, unknown fail-closed, interior guard, active-activity guard, no day-gate, corruption guard, save/load, revision dirty, input purity, field-scoped regression, wall-clock lock, witness event ids, memoryUnlockedTitle, cross-subject independence, keepsake idempotency, registry integrity.
- `src/game/photo-dialogue.test.ts`: 3 dialogue-echo acceptance tests (PHDE-01..03) — witness echo fires, omniscience guard, choice retires memory. Mirrors `community-dialogue.test.ts` SC-A pattern; choices at `session.nodes[session.currentNodeId].choices`; `recordNpcMemoryInPlace` prepends (unshift).
- Update pins: `inventory.test.ts` + `itemSubjectMapping.test.ts` length 33→34; `everyday.test.ts` practice count 9→10 + photography entries; `community-dialogue.test.ts` SC-A-06 (community echoes contiguous, not tail; golden tail = `everyday_photo_noticer`); `dialogueContext.test.ts` SF4-07 tail pin → `everyday_photo_noticer`; `stage3-baseline.test.ts` S3-G §3.3 (tail = photo echoes, community echoes precede).

## What this is NOT
Not a screenshot button (captures a named subject). Not a quota/leaderboard/scoring/timed challenge. Not a daily task. Not an isolated minigame (feeds journal, shelf, practice ladder, neighbor witnessing).
