# 02 — Architectural Weaknesses

**Recorded:** 2026-11-22, atop `origin/main` @ `a80a220`.
**Method:** synthesized from the six specialist investigations (Tasks 1-a..1-f, doc 09). Each weakness cites `file:line` evidence, states the blast radius for parallel multi-team development, and gives a **non-rewriting remediation direction**. Working systems are not rewritten; contracts are extracted and ownership is enforced.

Weaknesses are ranked by **parallel-development severity** (how much they block concurrent teams), not by raw code size. The top three (W1–W3) are the immediate blockers; W4–W7 are structural; W8–W10 are scaling/process.

---

## W1 — `sideFlags` is an un-owned, un-typed string bag mutated by 9 modules

**Severity: CRITICAL — the single biggest parallel-development hazard in the codebase.**

| | |
| :--- | :--- |
| Symptom | `world.sideFlags: Record<string, boolean \| number \| string>` is mutated by 9 modules with string keys (`orchardGatheringOutcome`, `pipZineTheme`, `herbLoafStyle`, `pondStandStyle`, `watchTuneStyle`, `lanternConflictOutcome`, exploration flag keys, …). There is no central registry, no owning module, no type safety. Typos silently produce dead flags. Two teams adding storyline content can collide on the same key with no compile-time signal. |
| Evidence | `src/game/types.ts:768` (`sideFlags: Record<string, boolean \| number \| string>`); mutators: `actions.ts:276-278`, `exploration.ts:115`, `storylines.ts:686-687`, `simulation.ts:115`, `narrative.ts`, `environment.ts`, `dialogueEngine.ts`, `journal.ts`, `storage.ts`. The only partial registry is `EXPLORATION_FLAG_KEYS` (`exploration.ts:81`). |
| Blast radius | Any team adding a storyline, exploration discovery, or quest outcome touches `sideFlags`. LR-3+ (multi-interior invitations/teaching), new storylines, new exploration content — all blocked by key-collision risk. Migrations cannot detect orphaned keys. |
| Remediation | Introduce a `SideFlagKey` string-literal union + a `SIDE_FLAG_DEFINITIONS` registry (typed owner + valid values + content team) colocated with `storylines.ts`. Add a `setSideFlag(world, key, value)` helper that asserts the key is registered. Migrations validate against the registry. **Pure addition; no existing behavior changes.** The un-typed bag stays as the storage representation; the registry is the typed access layer. |

---

## W2 — Four merge-points for parallel schema bumps serialize all data-layer work

**Severity: CRITICAL — two teams touching disjoint data slices still conflict.**

| | |
| :--- | :--- |
| Symptom | A parallel feature adding a field to `greenhouseState` and another adding a field to `bakeryState` will collide in **four** places, despite disjoint data: (1) `CURRENT_SCHEMA_VERSION` integer (`migrations.ts:137`); (2) the `migrateV{N}ToV{N+1}` function name + the `if (version === N)` ladder slot (`migrations.ts:2472-2475`); (3) the monolithic `sanitizeWorldState` return object literal (`migrations.ts:1482-1529`, ~330 lines); (4) `computeWorldSaveRevision` (`storage.ts:145-498`) — a new field not added to this hash means **autosave never fires on its changes** (silent data loss). |
| Evidence | `migrations.ts:137, 1203-1530, 2472-2475`; `storage.ts:145-498`. The migration chain is an imperative centralized ladder, not a registry. |
| Blast radius | Every parallel feature that persists new state. This is the structural reason LR-3+ multi-interior work is hard to parallelize. |
| Remediation | **(a)** Move each `migrateV{N}ToV{N+1}` body into `src/game/migrations/v<N>.ts` and re-export — the chain stays explicit and ordered (NOT a dynamic registry, which would break deterministic replay). **(b)** Split `sanitizeWorldState` into a per-subsystem sanitizer dispatch table keyed by top-level field — additive, not conflicting. **(c)** Split `computeWorldSaveRevision` into per-subsystem hash fragments registered alongside sanitizers; combine with XOR. **(d)** Add the duplicate-migration-version guard test (LR-A11, unfixed) — see doc 07 §3, doc 08. All moves are mechanical extraction; byte-identical save output is the verification gate. |

---

## W3 — `actions.ts` (4035 LOC, 47 reducers) is the merge-conflict bottleneck

**Severity: HIGH — any team adding a reducer edits the same file.**

| | |
| :--- | :--- |
| Symptom | `actions.ts` contains 47 exported pure reducers spanning 6 logical sub-domains (dialogue choice, sit&sip, world props/gifting, exterior landmarks, cottage interior, greenhouse, bakery/nook/copperwheel). Any team adding a cottage/greenhouse/bakery/nook/copperwheel/invitation reducer edits the same 4035-line file. It also shares private helpers (`getBakeryStateSafe`, `addBakeryMemory`, `buildGiftReactionLine`, …) that would become a new coupling magnet if split naively. |
| Evidence | `src/game/actions.ts:199-4035`; sub-domains catalogued in doc 09 §1-a §3. Correctly a leaf sink (only 2 production importers: `App.tsx`, `DialogueSheet.tsx` for one interface) — no cycle risk. |
| Blast radius | LR-3+ (multi-interior invitations), new interiors, new gift mechanics, new station rituals — all conflict here. |
| Remediation | **Extract leaf domains with zero cross-calls first** (copperwheel, nook, greenhouse each already have `getXSafe`+`addXMemory` pairs → `actions/<domain>/*.ts`). **Leave multi-domain actions** (gift→memory→relationship→flag, dialogue choice, next-day) in the monolith **until a golden-save replay harness exists** that pins their combined behavior. ~40% line reduction, ~10% of the risk. **Verification gate:** every `scripts/make_*_save.ts` fixture run through every action against v11 must produce byte-identical `JSON.stringify(world)` before and after the move; 528 tests green with zero test edits. See doc 03 §2, doc 08 §4. |

---

## W4 — `App.tsx` (1546 LOC) mixes shell lifecycle with 18 action dispatchers + the `commitWorld` outlier

**Severity: HIGH — HUD team + narrative team + LR team all edit `App.tsx`.**

| | |
| :--- | :--- |
| Symptom | `App.tsx` holds `worldRef`, autosave timers, `commitWorld`, AND 18 `handle*` action dispatchers (`handleSelectChoice`, `handleGiveGift`, `handleCookRecipe`, `handlePlantSeed`, `handleHarvestPlot`, `handlePropAction`, …). Every new player action grows the god component. Additionally `handleResetAndStart` (`App.tsx:295-324`) reimplements the `commitWorld` setter sequence inline instead of calling `commitWorld(fresh)` — drift risk: if `commitWorld` gains a setter, reset silently misses it, leaving HUD out of sync. |
| Evidence | `src/App.tsx:272-284` (`commitWorld`), `:295-324` (`handleResetAndStart` outlier), `:326-1148` (18 dispatchers). |
| Blast radius | Any new interactable, station, or intent adds a dispatcher to `App.tsx`. |
| Remediation | Extract a `useGameActions(worldRef, commitWorld, toast)` hook into `src/hooks/useGameActions.ts`; `App.tsx` becomes ~400 LOC of layout + lifecycle. Replace the `handleResetAndStart` inline block with `commitWorld(fresh)` + UI-state clears. **Pure extraction; no behavior change.** |

---

## W5 — `journal.ts` ghost `localStorage` channel (unsanctioned, un-migrated)

**Severity: HIGH — a second persistence channel outside the migration/sanitizer gate.**

| | |
| :--- | :--- |
| Symptom | `src/game/journal.ts:47,202,205,224,226` directly touches `window.localStorage` under key `little_somewhere_journal_read_v1`. `AGENTS.md` §2 sanctions only `storage.ts` (`window.localStorage`) and `audio.ts` (`AudioContext`) as browser-touch points. `journal.ts` is **not** sanctioned. The journal-read markers are not part of `WorldState`, not migrated, not sanitized, and silently lost/diverged on schema changes. Only `JournalDrawer.tsx` consumes them. |
| Evidence | `src/game/journal.ts:47,202,205,224,226`; `AGENTS.md` §2. |
| Blast radius | Save-integrity team + journal team diverge; reload tests miss read markers; a schema bump can silently drop journal-read state. |
| Remediation | Pick one: **(a)** fold `journalReadState` into `WorldState` (v12 migration — owned by journal team per doc 07 protocol); or **(b)** move the localStorage access into `storage.ts` as a delegated `JournalReadStoragePort` injected by `App.tsx`. Option (b) is lower-risk and keeps `journal.ts` pure. Enforced by the boundary-check script (doc 08 §3). |

---

## W6 — `audio.ts` uses `window.setTimeout`/`clearTimeout` outside its sanctioned guard scope

**Severity: MEDIUM — exception-scope creep.**

| | |
| :--- | :--- |
| Symptom | `AGENTS.md` §2 sanctions `audio.ts` for `AudioContext` only. `audio.ts:402,466,468` use `window.setTimeout`/`window.clearTimeout` for timer scheduling — outside the sanctioned scope. The module is still effectively browser-only, but the contract is now ambiguous. |
| Evidence | `src/game/audio.ts:12-23` (AudioContext guard), `:402,466,468` (timer APIs). |
| Blast radius | A future "pure audio engine for testing" refactor would discover the hidden timer dependency. Low immediate risk. |
| Remediation | Inject a `Scheduler` port (`setTimeout`/`clearTimeout`) into `CozyAudioEngine` constructor, defaulting to `globalThis`. Keeps the AudioContext exception intact; removes the extra implicit coupling. Alternatively, explicitly extend the `AGENTS.md` §2 sanctioned list to include `audio.ts` timer use — but the port injection is cleaner. |

---

## W7 — `StoryFlags` mutated by 10 modules with no ownership map

**Severity: HIGH — narrative + sim + dialogue content teams all set flags.**

| | |
| :--- | :--- |
| Symptom | `createInitialStoryFlags()` lives in `narrative.ts:24` but flags are set in `actions.ts` (dialogue choices), `simulation.ts`, `dialogue/everyday/*`, `dialogue/interiors/copperwheel.ts`, `playerController.ts`, `environment.ts` (read-only), `journal.ts`, `migrations.ts`, `storage.ts`. `DialogueChoice.setFlags?: Partial<StoryFlags>` (`types.ts:895`) allows any dialogue node to set any flag. Conflicting sets are silent. |
| Evidence | grep of `world.flags` / `flags.` across `src/game` (10 modules); `types.ts:895`. |
| Blast radius | Narrative team + sim team + dialogue content team all mutate `StoryFlags`; a new storyline setting a flag another team reads can produce ordering bugs. |
| Remediation | Add an owner annotation to each `StoryFlags` key (`StoryFlagOwnerMap`) and a `setStoryFlag(world, key, value)` helper that asserts ownership in dev mode. **No behavior change; just a chokepoint.** Lower-risk than W1 because `StoryFlags` is a fixed typed object (not a string bag), so compile-time already catches key typos — the gap is ownership, not typing. |

---

## W8 — `NeighborhoodCanvas.tsx` (2750 LOC, fan-out 39) couples scene assembly + input + animation loop

**Severity: MEDIUM — already half-extracted to `builders/*`; the remaining monolith is the tick/input director.**

| | |
| :--- | :--- |
| Symptom | `NeighborhoodCanvas.tsx` is a single `React.FC` with one `useEffect(..., [])` mounting the entire scene. It contains scene assembly (~570 LOC), characters + raycast proxies, input/A*/tap-to-walk (~1000 LOC), and the `tick()` animation loop (~450 LOC). Fan-out 39 (highest in repo). |
| Evidence | `src/scene/NeighborhoodCanvas.tsx:341` (single FC), `:541-1110` (assembly), `:1290-2300` (input), `:2300-2750` (tick). Already imports from `./builders/*` — half-extracted. |
| Blast radius | 3D team + UX team + perf team all touch the mount `useEffect`. |
| Remediation | **Extract the input/raycast layer** (`findNearestWalkablePoint`, `findNearestInteriorWalkablePoint`, pointer handling) into `src/scene/inputDirector.ts` as pure functions taking scratch objects explicitly (~300 lines out, near-zero risk). **Leave the tick + refs intact** — the module-scope scratch (`_vec3A`, `_raycaster`, `_pointer`, `_groundPlane` at `:221-226`) and the `useRef` mirror pattern MUST stay single-context to honor zero-per-frame-allocations. **Do NOT split the tick into per-region controllers** — that forces passing scratch down (allocation risk) or duplicating (state-desync risk). This is a merge-ergonomics problem dressed as architecture; the input extraction captures 80% of the benefit. Verification gate: headless Chromium screenshot diff at 1440×900 + 390×844 against baselines; `perfProbe` per-frame allocation count unchanged. |

---

## W9 — Character rigs emit ~50–80 loose meshes each (draw-call scaling breakpoint)

**Severity: MEDIUM (perf) — breaks first at ~30–40 residents on mobile.**

| | |
| :--- | :--- |
| Symptom | `builders/characters.ts:795-1181` creates individual `THREE.Mesh` objects per facial feature (eyes, nose, freckles), hair locks, buttons, hands, satchel parts. Some merging exists (boots `:371`, limbs) but most detail meshes stay loose. With 10 residents ≈ 600–800 draw calls; at 50 residents it dominates the frame. |
| Evidence | `src/scene/builders/characters.ts:795-1181`; full scene ~400–600 draw calls today. |
| Blast radius | Cast-growth content (LR-3+ and beyond) hits mobile frame budget before sim or save do. |
| Remediation | Merge static character sub-parts into per-rig `BufferGeometry` via `mergeGeometries` (already used for boots/staging); keep only animated pivots (limbs, head, scarf) loose. Cuts per-rig draw calls from ~60 to ~8–12. **Non-rewriting:** the rig API (`CharacterRig`) is unchanged; only the builder internals consolidate. Verification gate: draw-call count via `perfProbe` before/after; screenshot diff. |

---

## W10 — No CI test/lint workflow; no tag-on-merge durability

**Severity: HIGH (process) — the lost-branch incident's root cause, and the highest-leverage fix.**

| | |
| :--- | :--- |
| Symptom | `.github/workflows/` contains exactly one file, `deploy-pages.yml`, which runs only on `push: main`, runs only `npm run build` (no `npm test`, no `npm run lint`), and never runs on PRs. A PR can merge with zero tests run; the only gate is the author's self-report. Separately, the "lost branch" incident (`docs/architecture/build10-lr-recovery/13-final-integration-state.md` §1) was a worktree-durability failure: the corrective branch lived only in a local worktree, was never pushed to a remote durable ref, and was GC'd. |
| Evidence | `.github/workflows/deploy-pages.yml`; `docs/architecture/build10-lr-recovery/13-final-integration-state.md` §1; `docs/architecture/living-relationships/13-adversarial-review.md` LR-A11. |
| Blast radius | Every parallel team. Without CI, integration conflicts surface only at merge time. Without tags, any unmerged branch is one worktree deletion away from being lost forever. |
| Remediation | **(a)** Add `.github/workflows/ci.yml` running `npm test` + `npm run lint` + `npm run build` on every PR and every push (required status check). **(b)** Add a `git tag build-<N>-<sha>` step on every merge to main (tags are GC-proof). **(c)** Add the duplicate-migration-version guard test (LR-A11). **(d)** Add the boundary-check script (`scripts/check_layer_boundaries.ts`) run in CI. This is the single highest-leverage action — see doc 08. **Implemented as part of this initiative** (doc 08 §3, §4). |

---

## Secondary weaknesses (tracked, lower parallel-dev severity)

| ID | Weakness | Evidence | Direction |
| :--- | :--- | :--- | :--- |
| W11 | `prototypes/willowLaneDiorama.ts` (1722 LOC) is production code misfiled under `prototypes/` | imported by `NeighborhoodCanvas.tsx:110-114` | rename to `builders/willowStepCottage.ts` (no behavior change) |
| W12 | `PropInteractionResult` interface lives in `actions.ts:162` but is consumed by `DialogueSheet.tsx` — drags a 4035-line module into a UI dep | `actions.ts:162`, `DialogueSheet.tsx:59` | move to `types.ts` |
| W13 | `DIALOGUE_TOPICS` re-exported from `narrative.ts:387` despite canonical source in `dialogue/index.ts:41` | `narrative.ts:379-387` (backwards-compat shim) | mark `@deprecated`, migrate importers as touched |
| W14 | `storage.ts:15` imports `simulation.ts` (`createInitialNpcRuntime`) — persistence→sim coupling | `storage.ts:15` | extract `createInitialNpcRuntime` into `npcRuntime.ts` leaf; `simulation.ts` re-exports |
| W15 | Cross-subsystem derived reads are implicit, un-typed contracts | `cottageInterior.ts:1906-1910` (← greenhouse/bakery/nook/memories), `progressionVisuals.ts:379-384`, `journal.ts:917-1008` | extract `ProgressionReadModel` interface co-owned by the source subsystems (doc 06 §3) |
| W16 | `progressionVisuals.ts` holds 6 module-scope `let` caches (memoization by signature) | `progressionVisuals.ts:170-173,451-452` | convert to class instances with per-consumer cache |
| W17 | Per-frame options-object allocation in `environmentRenderer.ts:742-746,755-760` (only real zero-GC violation in hot loop) | `environmentRenderer.ts:742-760` | hoist module-scratch option objects |
| W18 | `world.worldEvents.some(e => e.id === encId)` is O(E) per candidate pair inside O(N²) encounter loop | `simulation.ts:922` | replace with `Set<string>` of recent encounter IDs (O(1)) |
| W19 | `computeSaveStamp` runs full FNV hash every 5 s even when idle | `App.tsx:1112-1118` | incremental per-field dirty flags |
| W20 | `SceneErrorBoundary` does not remount on HMR | `App.tsx:123-158` | dev-only: remount canvas on HMR of `NeighborhoodCanvas.tsx` |
| W21 | `@google/genai` is a phantom dependency (declared, imported nowhere in runtime) | `package.json`, grep | remove from dependencies or move to `devDependencies`; clean `.env.example` (doc 08 §6) |
| W22 | GitHub Pages deploy uses `force_orphan: true` (destroys history, no rollback) + third-party action + main-only | `.github/workflows/deploy-pages.yml` | doc 08 §7 |
| W23 | `dailyLettersRead` deduped but not count-capped | `migrations.ts:1367-1375` | add `MAX_DAILY_LETTERS_READ` cap mirroring other bounded collections |
| W24 | `npcRelations` has no explicit count cap (relies on implicit C(N,2) from registered-resident filter) | `relationships.ts:22`, `migrations.ts:690-693` | add `MAX_NPC_RELATION_PAIRS` cap with oldest-eviction if cast grows |

---

## Rejected remediations (with rationale)

| Proposal | Verdict | Rationale |
| :--- | :--- | :--- |
| **Event bus / mediator** for cross-cutting concerns (story flags → environment reactivity) | **REJECTED** | Destroys the single-source-of-truth reducer model and deterministic save replay. The existing `composeEnvironmentState` poll (`App.tsx:273`) is cheaper, deterministic, and already shipped. An event bus is a multi-writer primitive; the LR adversarial review's entire race table is about multi-writer hazards. |
| **Dynamic migration registry** (file-system scan, sort-by-version) | **REJECTED** | Non-deterministic across bundlers/Node versions; breaks the byte-identical replay guarantee. Use per-version files behind an explicit re-export chain instead (W2 remediation). |
| **Ownership matrix as a human-maintained document** | **REJECTED (as doc); ACCEPT (as machine-checked gate)** | This is an AI-agent-driven repo; human-maintained ceremony is violated by every other PR and becomes a rubber stamp or blocker. Replace with an ESLint `no-restricted-imports` rule / boundary-check script that machine-checks the three-layer boundary (doc 04, 08). |
| **Freeze `types.ts` as a versioned schema** | **REJECTED (freeze); ACCEPT (split)** | `types.ts` is already the coupling magnet (105 importers). Freezing serializes all parallel work on one file. The schema version already lives in `migrations.ts`. Instead: split into shared `types.ts` (cross-layer: `WorldState`, `Vec2`, `ResidentId`) + per-domain `<domain>/types.ts`. |
| **Rewrite `actions.ts` / `NeighborhoodCanvas.tsx` / `migrations.ts`** | **REJECTED** | Working systems. Decomposition is mechanical extraction behind guard tests, not rewrite. See doc 03. |

---

The target architecture in doc 03 turns these remediations into a sequenced, gated plan. The ownership matrix in doc 04 assigns every subsystem an owner. The protocol in doc 07 makes parallel work safe.
