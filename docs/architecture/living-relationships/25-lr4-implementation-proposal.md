# 25 — LR-4 Implementation Proposal & Multi-Stream Audit Reconciliation

- **Milestone**: Living Relationships — LR-4 (Teaching Flag / Knowledge Registry on Shared Activities)
- **Date**: 2026-11-26
- **Status**: `Tested` locally (`1061/1061` unit tests, `tsc` clean, boundary clean, stress harness clean, `vite build` green, headless Chromium `1440×900` & `390×844` verified; Git/PR merge blocked in snapshot container lacking `.git`/`gh`)
- **Authoritative Specs**: `docs/MASTER-ROADMAP.md`, `docs/architecture/living-relationships/14-revised-architecture.md` (§10), `docs/architecture/living-relationships/23-lr4-teaching-specification.md` (§1–§6), `docs/architecture/master-architecture/03-target-architecture.md` (§8), `docs/architecture/master-architecture/10-operating-directive.md` (§3, §8)

---

## 1. Verified Execution Baseline & Environment Constraints

Re-verified on the actual workspace snapshot prior to any code edit:
- **Layer Boundaries** (`npx --yes tsx scripts/check_layer_boundaries.ts`): exit 0 (`73` game files, `83` scene files, `15` component files; `src/game/` acyclic; zero DOM/Three.js leaks).
- **Unit Test Suite** (`npm test`): exit 0 (`1053` tests across `5` top-level files/runners, `0` failures), including full LR-1/LR-2 (`activities.test.ts`, `invitations.test.ts`, `occupancy.test.ts`, `lr-tick-load.test.ts`) and LR-3 (`lr3-slice1-battery.test.ts`, `lr3-slice2-battery.test.ts`, `lr3qa-foundation.test.ts`) batteries.
- **Typecheck** (`npm run lint`, `tsc --noEmit`): exit 0.
- **Stress Harness** (`npx --yes tsx scripts/longrun_stress.ts --quick`): exit 0 (`0` hard invariant violations; `F_deterministic_replay` and `B_twin_continuity` both `byte-identical=true`).
- **Integrated Schema & Content Reality** (reconciling stale SHA references in `doc 23`):
  - `CURRENT_SCHEMA_VERSION` is already **`13`** (`src/game/migrations.ts`).
  - **LR-3 (`share_morning_pastry`, Clara, Hearth & Crumb Bakery) is already integrated**, with `LR3-48` explicitly pinning that bakery completions leave `teaching.known` empty (`getSharedActivityDef('share_morning_pastry')?.knowledgeGranted === undefined`).
  - `DIALOGUE_TOPICS` currently has **`95` topics** (`scripts/dialogue-topics-golden.json`), ending with `REFLECTION_TOPICS` (`SF-4`), `COMMUNITY_ECHO_TOPICS` (`GA-1`), and `PHOTO_ECHO_TOPICS` (`everyday_photo_noticer` at index 94).
- **Environment Constraints**: No `.git` metadata or `gh` CLI is present in this sandbox snapshot, and no parallel subagent runtime exists; therefore, all research and adversarial review tracks execute sequentially under one engineer, and git branch/PR actions remain blocked at the container boundary.

---

## 2. Sequential 6-Stream Research & Cross-System Audit Findings

1. **Roadmap & Product Vision (`docs/MASTER-ROADMAP.md`)**:
   - LR-4 unlocks the teaching loop seeded in LR-1/LR-2 (`share_featured_reading` -> `'nora_featured_reading'`) while honoring Pillar 3 (personalities) and Pillar 6 (no grinding, no XP bars, no FOMO, no skill-tree UI, no currencies, no decay).
   - LR-5 (`arthur_escapement_basics`) and Clara teaching remain explicitly out of scope.
2. **Architecture & Persistence (`src/game/activities.ts`, `migrations.ts`, `storage.ts`, `simulation.ts`, `types.ts`)**:
   - `TeachingState` (`{ known: string[] }`), `SharedActivityDef.knowledgeGranted`, `evaluateDialogueCondition`'s `requiresTeachingKnown`, `computeWorldSaveRevision` fingerprinting (`state.teaching?.known ?? []`), and `stepSimulation`'s pure-wrapper clone already exist.
   - Only two pure-engine seams are incomplete: (a) `completeSharedActivity` ignores `def.knowledgeGranted`, and (b) `sanitizeLivingRelationships` in `migrations.ts` dedupes/filters empty strings without stripping unknown knowledge IDs or warning.
   - `migrations.ts` already imports `./activities` (`SHARED_ACTIVITIES`, `createInitialTeachingState`); importing `KNOWLEDGE_IDS` introduces zero dependency cycle.
3. **Gameplay & Narrative Design (`dialogueEngine.ts`, `dialogueContext.ts`, `everyday/reflections.ts`, `doc 23 §2.1`)**:
   - Critical interaction discovered during audit: `REFLECTION_TOPICS` (`everyday_shared_visit_echo`, `'any'`, `event_reaction`, priority `14` + SF-4 R1 boost `5` = **`87`**) reacts to unmentioned `shared_featured_reading`. If a Nora teaching topic using `requiresNpcMemory: { ..., unmentionedOnly: true }` scored below `87`, `everyday_shared_visit_echo` would win immediately after reading, flip `mentionedToPlayer = true`, and make the teaching topic permanently unreachable!
   - Resolution: Place the single new Nora topic (`teaching_nora_featured_reading`) in `TEACHING_TOPICS` (`src/game/dialogue/everyday/teaching.ts`) with `residentId: 'nora'`, `category: 'event_reaction'`, `priority: 20` (score **`88` > `87`**, still below `event_bell_celebration` `92`, `inv_*` `92..126`, and `quest_milestone` `100+`), using `tag: 'shared_featured_reading'` (singular) so `computeContextBoosts` adds `0` boost (honoring `doc 23 §1`: teaching topics do not rely on SF-4 context boosts), plus `requiresMet: true`, `requiresTeachingKnown: ['nora_featured_reading']`, `notSeenToday: true`, `maxSeenCount: 1`, and `markMemoryTagsMentioned: ['shared_featured_reading']` on both choices. Thus: right after shared reading, Nora shares what you learned together (`88`), retires the unmentioned `shared_featured_reading` echo without nagging on later days, while gossip copies of `shared_featured_reading` on other residents still surface `everyday_shared_visit_echo`.
4. **Golden Snapshot & Tail-Pin Migration**:
   - Appending `TEACHING_TOPICS` strictly at the end of `DIALOGUE_TOPICS` (`95 -> 96`) preserves all 95 prior entries field-for-field.
   - Existing append-only milestone pin assertions in `src/game/dialogueContext.test.ts` (`SF4-07`), `src/game/community-dialogue.test.ts` (`SC-A-06`), and `src/game/stage3-baseline.test.ts` (`S3-G §3.3`) explicitly document migrating tail assertions on append and will be updated cleanly without reordering existing modules.
5. **QA & Determinism**:
   - Deterministic replay and twin-clone parity hold automatically because `KNOWLEDGE_IDS` is static and `completeSharedActivity` commits `teaching.known` deterministically before `computeWorldSaveRevision` runs.
6. **LR-3 Boundary & Concurrency Safety**:
   - `share_morning_pastry`, `dialogue/invitations/clara.ts`, `bakery.ts`, `bakerySpatial.ts`, and `lr3-*` test batteries stay 100% untouched. `LR3-48` remains green unmodified.

---

## 3. Explicit Settled Decisions (`D-4A`..`D-4D`)

| ID | Decision | Settled Choice | Rationale |
|---|---|---|---|
| **D-4A** | `KnowledgeId` typing | **(b)** Keep `TeachingState.known: string[]` and `SharedActivityDef.knowledgeGranted?: string`; export `KNOWN_KNOWLEDGE_IDS` + `KNOWLEDGE_IDS: ReadonlySet<string>` derived cleanly from `SHARED_ACTIVITIES`. | Forward-compatible save stripping; zero type churn on `SharedActivityDef` shared with LR-3. |
| **D-4B** | `TeachingState` shape | **(a)** Keep `{ known: string[] }` without `taughtBy`/`taughtDay`; keep `CURRENT_SCHEMA_VERSION = 13`. | Satisfies all LR-4 observables with zero schema bump and zero migration collision risk. |
| **D-4C** | Timing vs LR-3 | **(b) Post-LR-3 integrated execution** with strict file disjointness. | LR-3 is already landed on this codebase; append-only golden regen `95 -> 96` sits cleanly after `PHOTO_ECHO_TOPICS`. |
| **D-4D** | Post-teaching repeat semantics | **(b)** Preserve pre-existing `already_completed` memory guard; grant occurs once and future duplicate/pre-seeded calls remain strict no-ops. | Matches LR2-07 / LR2-07b invariants without introducing XP/currency/repeat grind. |

---

## 4. 11-Field Implementation Proposal

1. **Goal**: Deliver Living Relationships Milestone **LR-4** — atomic knowledge granting on shared-activity completion (`nora_featured_reading`), save/load registry validation with explicit warnings for unknown IDs, and Nora's first `requiresTeachingKnown` post-reading dialogue topic — while keeping LR-3 (`share_morning_pastry`), cozy constitution, determinism, and 3-layer separation intact.
2. **Scope & Non-Goals**:
   - *In Scope*: `KNOWLEDGE_IDS` registry + grant inside `completeSharedActivity` (`activities.ts`), sanitizer unknown-ID strip + warning (`migrations.ts`), `TEACHING_TOPICS` Nora post-reading topic (`dialogue/everyday/teaching.ts` + tail spread in `dialogue/index.ts`), golden snapshot regen `95 -> 96` + justification doc, migrated tail-pin assertions, and `src/game/lr4-teaching.test.ts` (`LR4-01`..`LR4-07`).
   - *Out of Scope*: LR-5 (`arthur_escapement_basics`, Copperwheel workbench), Clara knowledge grants, `taughtBy`/`taughtDay` schema v14 expansion, skill-tree/XP UI, oak tree repositioning (unrelated prior user prompt).
3. **Dependencies (`A`/`B`/`C`/`D`)**:
   - **A (Hard)**: `SharedActivityDef.knowledgeGranted`, `TeachingState.known`, `requiresTeachingKnown` condition evaluator (all present).
   - **B (Soft)**: Golden snapshot `scripts/dialogue-topics-golden.json` and append-only pin tests (`dialogueContext.test.ts`, `community-dialogue.test.ts`, `stage3-baseline.test.ts`).
   - **C (Informational)**: SF-4 `everyday_shared_visit_echo` interaction analyzed and resolved via priority `20` (`88 > 87`) and singular `tag`.
   - **D (Blocked/Deferred)**: Git/GitHub branch/PR actions unavailable (no `.git`/`gh`); LR-5 / Arthur (`arthur_escapement_basics`) deferred.
4. **Module Ownership & Boundary Matrix**:
   - `src/game/activities.ts`: owns `KNOWLEDGE_IDS` & `completeSharedActivity` atomic write.
   - `src/game/migrations.ts`: owns `sanitizeLivingRelationships` unknown-ID filter + warning emission.
   - `src/game/dialogue/everyday/teaching.ts` + `src/game/dialogue/index.ts`: owns `TEACHING_TOPICS` & tail-append registration.
   - **Zero edits** to `invitations.ts`, `occupancy.ts`, `simulation.ts`, `storage.ts`, `types.ts`, `bakery.ts`, `dialogue/invitations/clara.ts`, `src/scene/`, or `src/components/`.
5. **Architecture & Data Flow**:
   `inv_nora_indoor_reading` / `nook_chair` -> `completeSharedActivity(world, 'share_featured_reading')` -> refusal checks + `already_completed` guard -> append `def.knowledgeGranted` into `nextWorld.teaching.known` (deduped) + affinity/memory/event/archive/clear -> exterior talk to Nora -> `selectDialogueSession` matches `teaching_nora_featured_reading` (`88`) -> player choice marks `shared_featured_reading` mentioned -> `serializeWorldState`/`deserializeWorldState` validate against `KNOWLEDGE_IDS` (warn on strip).
6. **Backward Compatibility & Save Safety**:
   `CURRENT_SCHEMA_VERSION` stays `13`; existing valid saves (`known: []` or `['nora_featured_reading']`) load/save warning-free; unknown strings (e.g., `'phantom_knowledge'`) strip with `warnings.push(...)` on both load and save paths (`sanitizeLivingRelationships` invoked by both `migrateWorldState` and `serializeWorldState`).
7. **Cozy Design Alignment**:
   Pure relational storytelling ("what you learned by lamplight") with no XP bar, stat gate, skill panel, or timer; respects `maxSeenCount: 1` so Nora never nags.
8. **Determinism & Performance Impact**:
   Zero RNG/wall-clock usage, zero per-tick runtime allocations (`completeSharedActivity` is discrete action; condition check is `Array.includes` over a 1-item array).
9. **Test Strategy (`LR4-01`..`LR4-07`)**:
   Author `src/game/lr4-teaching.test.ts` testing fresh grant, decline/expire/host-refusal empty grant, duplicate/pre-seeded strict no-op, dialogue topic hidden before grant & surfaced end-to-end after grant (including retiring cleanly without breaking SF-4 gossip echoes), sanitizer unknown-ID strip + warning + dedupe, save/load & mid-visit & day-advance & `computeWorldSaveRevision` & `stepSimulation` parity, and LR-3 isolation (`share_morning_pastry`).
10. **Verification & Runtime Gates**:
    `npm test`, `npm run lint`, `npx --yes tsx scripts/check_layer_boundaries.ts`, `npx --yes tsx scripts/longrun_stress.ts --quick`, `compile_applet` + `lint_applet`, `restart_dev_server`, and live headless Chromium (`playwright-cli`) Desktop (`1440×900`) & Mobile (`390×844`) end-to-end playthrough check with zero console errors.
11. **Risks & Rollback**:
    Low surface area (3 production modules + 1 new topic module + golden snapshot). Reversing requires only reverting `TEACHING_TOPICS` spread, sanitizer check against `KNOWLEDGE_IDS`, and the 5-line grant block inside `completeSharedActivity`.
