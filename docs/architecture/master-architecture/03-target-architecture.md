# 03 — Target Architecture

**Recorded:** 2026-11-22, atop `origin/main` @ `a80a220`.
**Purpose:** the target state for each subsystem, the decomposition strategy (adversarial-adjusted), and the explicitly-rejected alternatives with rationale. This is a **sequenced, gated plan**, not a rewrite. Every step preserves the standing invariants (doc 00 §"Standing invariants").

---

## 1. Architectural target — one sentence

> **A three-layer, deterministic, contract-first life-simulation where each subsystem is owned by exactly one team, shared state is accessed through typed registries rather than smeared bags, and every change is verified by machine-checked gates (CI, boundary script, golden-replay harness) before merge.**

The three-layer structure (`src/game/` pure / `src/scene/` Three.js / `src/components/`+`App.tsx` React) is **not changing**. It is verified, correct, and load-bearing. What changes is: (a) the monoliths inside each layer are decomposed into owned modules; (b) the implicit contracts (`sideFlags`, `StoryFlags` ownership, cross-subsystem derived reads) are made explicit and typed; (c) the merge-points that serialize parallel work are split into additive registries; (d) machine-checked gates replace human ceremony.

---

## 2. Sequenced decomposition plan

Each step is **independently mergeable**, **non-rewriting**, and **gated by a verification harness**. Steps are ordered by dependency: guard tests first (so later extractions can be proven safe), then leaf extractions, then contract extractions, then the hardest splits.

### Phase A — Foundation gates (no production code changes)

| Step | Deliverable | Owner | Verification gate | Status |
| :--- | :--- | :--- | :--- | :--- |
| A1 | `.github/workflows/ci.yml` — `npm test` + `npm run lint` + `npm run build` on every PR + push; required status check | Integration lead | break a test on a throwaway branch → check fails | **Implemented in this initiative (doc 08)** |
| A2 | `git tag build-<N>-<sha>` on every merge to main (GC-proof durability) | Integration lead | tag exists after merge | **Implemented in this initiative (doc 08)** |
| A3 | `scripts/check_layer_boundaries.ts` — machine-checks the three-layer boundary (`src/game/` no `three`/React/browser except sanctioned; `src/scene/` no `src/components/`; `src/components/` no `three` direct) | Integration lead | script exits non-zero on a planted violation | **Implemented in this initiative (doc 08)** |
| A4 | Duplicate-migration-version guard test — fails if two `migrateV{N}ToV{N+1}` claim the same `N` (LR-A11) | Persistence lead | plant a duplicate → test fails | **Implemented in this initiative (doc 08)** |

**Rationale:** the adversarial review (doc 09 §1-f) established that gates must be machine-checked in an agent-driven repo. Phase A is the highest-leverage, lowest-risk work and unblocks confident execution of Phases B–D.

### Phase B — Leaf extractions (mechanical, low-risk, high merge-conflict reduction)

| Step | Deliverable | Owner | Verification gate |
| :--- | :--- | :--- | :--- |
| B1 | Extract `actions/copperwheelActions.ts`, `actions/nookActions.ts`, `actions/greenhouseActions.ts` (leaf domains with `getXSafe`+`addXMemory` pairs, zero cross-domain calls) | Copperwheel/Nook/Greenhouse teams | golden-replay: every `scripts/make_*_save.ts` fixture run through every action → byte-identical `JSON.stringify(world)` before/after; 528 tests green, zero test edits |
| B2 | Extract `scene/inputDirector.ts` (raycast + tap-to-walk + pointer handling as pure functions taking scratch objects explicitly) | Scene team | headless screenshot diff 1440×900 + 390×844; `perfProbe` per-frame allocation count unchanged |
| B3 | Move `PropInteractionResult` from `actions.ts:162` → `types.ts` | Contract lead | `tsc` clean; `DialogueSheet.tsx` no longer depends on `actions.ts` |
| B4 | Rename `prototypes/willowLaneDiorama.ts` → `builders/willowStepCottage.ts` (production code misfiled) | Scene team | `tsc` clean; 528 tests green |
| B5 | Mark `narrative.ts:387` `DIALOGUE_TOPICS` re-export `@deprecated`; migrate the (currently zero) external importers as touched | Narrative team | doc-only |
| B6 | Extract `createInitialNpcRuntime` → `npcRuntime.ts` leaf; `simulation.ts` re-exports; `storage.ts:15` depends on leaf not sim | Persistence lead | 528 tests green |

### Phase C — Contract extractions (the parallel-dev unblockers)

| Step | Deliverable | Owner | Verification gate |
| :--- | :--- | :--- | :--- |
| C1 | `SideFlagKey` string-literal union + `SIDE_FLAG_DEFINITIONS` registry (owner + valid values) + `setSideFlag(world, key, value)` helper; colocated with `storylines.ts` (W1) | Narrative lead | compile-time: unregistered key rejected; runtime dev-mode assert; migration validates against registry |
| C2 | `StoryFlagOwnerMap` + `setStoryFlag(world, key, value)` dev-mode ownership assert (W7) | Narrative lead | dev-mode assert fires on cross-owner set; 528 tests green |
| C3 | `ProgressionReadModel` interface co-owned by greenhouse/bakery/nook/copperwheel/journal — binds the implicit derived-read contracts (W15) | Contract lead | a test asserting every reader's field exists in the interface; rename any field → compile error in readers |
| C4 | Split `types.ts` into `src/game/types.ts` (cross-layer: `WorldState`, `Vec2`, `ResidentId`, `PlayerLocation`, `TimePhase`) + per-domain `src/game/<domain>/types.ts` (greenhouse, bakery, nook, copperwheel, cottage, inventory) | Contract lead | `tsc` clean; `src/scene/`+`src/components/` import only from `src/game/types.ts`; 528 tests green |

### Phase D — Schema-bump parallelization (the hardest, gated by Phase A4)

| Step | Deliverable | Owner | Verification gate |
| :--- | :--- | :--- | :--- |
| D1 | Move each `migrateV{N}ToV{N+1}` body → `src/game/migrations/v<N>.ts`; `migrations.ts` re-exports in an explicit ordered chain (NOT a dynamic registry) | Persistence lead | every `make_*_save.ts` fixture migrates to v11 byte-identical; `detectSchemaVersion` unchanged; A4 guard passes |
| D2 | Split `sanitizeWorldState` into per-subsystem sanitizer dispatch table keyed by top-level field (additive) | Persistence lead | byte-identical save output; `save-integrity.test.ts` green |
| D3 | Split `computeWorldSaveRevision` into per-subsystem hash fragments registered alongside sanitizers; combine with XOR | Persistence lead | autosave fires on changes to every persisted field; `storage.test.ts` round-trip green |

### Phase E — Remaining monolith splits (gated by golden-replay harness)

| Step | Deliverable | Owner | Verification gate |
| :--- | :--- | :--- | :--- |
| E1 | Extract `useGameActions(worldRef, commitWorld, toast)` hook from `App.tsx`; replace `handleResetAndStart` inline block with `commitWorld(fresh)` (W4) | HUD lead | 528 tests green; zero test edits; HUD state in sync after reset |
| E2 | Extract `actions/bakeryActions.ts`, `actions/cottageActions.ts`, `actions/exterior.ts`, `actions/worldProps.ts`, `actions/gifting.ts` (multi-domain actions — REQUIRES golden-replay harness first) | Respective teams | golden-replay harness pins combined behavior; 528 tests green |
| E3 | Extract `scene/sceneAssembly.ts` (builder wiring) from `NeighborhoodCanvas.tsx` (W8 remainder — tick + refs stay) | Scene team | screenshot diff; `perfProbe` allocation unchanged |
| E4 | Character rig geometry merge (W9) — `mergeGeometries` for static sub-parts | Scene team | draw-call count ↓ per `perfProbe`; screenshot diff |
| E5 | Fold `journalReadState` into `WorldState` v12 OR move localStorage to `storage.ts` port (W5) | Journal team | boundary-check script passes; journal-read state migrates with schema |

---

## 3. Target module topology (per layer)

### `src/game/` target

```
src/game/
├── types.ts                      # cross-layer contracts ONLY (WorldState, Vec2, ResidentId, ...)
├── core/        time.ts, rng.ts
├── world/       worldMap.ts, navigation.ts, walkability.ts, playerController.ts
├── sim/         simulation.ts, memories.ts, relationships.ts, residents.ts, npcRuntime.ts (extracted)
├── narrative/   storylines.ts (+ SideFlagKey/SIDE_FLAG_DEFINITIONS registry), journal.ts, 
│                dialogueEngine.ts, narrative.ts (stub), progressionVisuals.ts
├── dialogue/    index.ts + leaf modules (unchanged — already well-organized)
├── interiors/   cottage.ts, greenhouse.ts, bakery.ts, bookNook.ts, copperwheel.ts
│                 (+ per-domain types.ts)
├── items/       inventory.ts (+ types.ts)
├── lr/          invitations.ts, occupancy.ts, activities.ts
├── env/         environment.ts, exploration.ts
├── actions/     (extracted leaf + multi-domain reducers behind contracts)
│   ├── cottageActions.ts, greenhouseActions.ts, bakeryActions.ts, nookActions.ts, copperwheelActions.ts
│   ├── exterior.ts, worldProps.ts, gifting.ts, dialogueChoice.ts, sitSip.ts
│   └── contracts.ts   # GameAction, ActionResult, PropInteractionResult (moved from actions.ts:162)
├── persistence/
│   ├── migrations/
│   │   ├── chain.ts            # explicit ordered re-export chain (NOT dynamic registry)
│   │   ├── sanitize.ts         # per-subsystem sanitizer dispatch table
│   │   ├── defaults.ts         # createDefaultWorldState
│   │   └── v<N>.ts             # one file per version step
│   ├── storage.ts              # localStorage + revision hash (per-subsystem fragments)
│   └── audio.ts                # Web Audio (Scheduler port injected)
```

### `src/scene/` target

```
src/scene/
├── NeighborhoodCanvas.tsx       # mount shell + refs + tick() ONLY (~300 LOC after E3)
├── sceneAssembly.ts             # builder wiring (extracted)
├── inputDirector.ts             # raycast + tap-to-walk (pure, scratch-explicit)
├── environmentRenderer.ts, progressionPresentation.ts, textures.ts, materials.ts, 
│   waterShaders.ts, models.ts, perfProbe.ts, contactShadows.ts, ambientSway.ts, residentFeel.ts
├── builders/
│   ├── buildings.ts (or split per-building), cottageInterior.ts, characters.ts, 
│   │   {copperwheel,greenhouse,bakery,bookNook}Interior.ts, landmarks.ts, 
│   │   orchard.ts, orchardMicroLife.ts, wilds.ts, vegetation.ts, botanicalDressing.ts, 
│   │   reactiveProps.ts, porchSeasonLife.ts, interiorKit.ts
│   └── willowStepCottage.ts     # renamed from prototypes/willowLaneDiorama.ts (B4)
```

### `src/components/` + `App.tsx` target

```
src/
├── App.tsx                      # shell lifecycle + HUD layout + commitWorld ONLY (~400 LOC after E1)
├── hooks/
│   └── useGameActions.ts        # 18 handle* dispatchers extracted (E1)
└── components/                  # unchanged (DialogueVisuals, JournalDrawer, DialogueSheet, ...)
```

---

## 4. What stays single-context (do NOT split)

These are load-bearing single-context surfaces. Splitting them breaks standing invariants.

| Surface | Why it stays single-context |
| :--- | :--- |
| `NeighborhoodCanvas.tsx` `tick()` + module-scope scratch (`_vec3A`, `_raycaster`, `_pointer`, `_groundPlane` at `:221-226`) | Zero-per-frame-allocations invariant. Per-region controllers force passing scratch down (allocation) or duplicating (desync). |
| `commitWorld` (`App.tsx:272-284`) | Atomic React-side funnel invariant. Splitting across multiple state updates reintroduces render-teardown / WebGL-context-reset hazard. |
| `migrateWorldState` linear chain (`migrations.ts:2412-2478`) | Deterministic replay invariant. A dynamic registry is non-deterministic across bundlers. The chain stays explicit and ordered; only the *bodies* move to per-version files. |
| `sanitizeWorldState` whitelist rebuild | Save-integrity invariant. The whitelist backstop must construct the world from known fields. Split into per-subsystem dispatch (additive) but keep the single reconstruction pass. |
| `composeEnvironmentState` poll (`App.tsx:273`) | Determinism. Replaces any "event bus" proposal — the poll is cheaper and deterministic. |

---

## 5. Rejected alternatives (with rationale — from the adversarial review, doc 09 §1-f)

| Proposal | Verdict | Rationale |
| :--- | :--- | :--- |
| Event bus / pub-sub mediator for cross-cutting concerns | **REJECTED** | Destroys deterministic replay and the single-reducer model. The existing `composeEnvironmentState` poll is cheaper, deterministic, shipped. An event bus is a multi-writer primitive; the LR race table is entirely about multi-writer hazards. If decoupling is truly needed, use a compile-time discriminated-union event list dispatched through a single pure `applyEvent(world, event)` reducer — never runtime pub/sub. |
| Dynamic migration registry (filesystem scan / sort-by-version) | **REJECTED** | Non-deterministic across bundlers/Node versions; breaks byte-identical replay. Use per-version files behind an explicit re-export chain (Phase D1). |
| Decompose `NeighborhoodCanvas.tsx` tick into per-region controllers | **REJECTED** | Breaks zero-per-frame-allocations. Extract input layer only (Phase B2); tick + refs stay single-context. |
| Decompose `actions.ts` multi-domain actions before a golden-replay harness exists | **DEFERRED (not rejected)** | Multi-domain actions (gift→memory→relationship→flag) are atomic side-effect chains; splitting before a test pins the combined behavior risks silently fragmenting an atomic chain. Extract leaf domains first (Phase B1); multi-domain actions wait for Phase E2 + harness. |
| Freeze `types.ts` as a versioned schema | **REJECTED (freeze); ACCEPT (split)** | Freezing serializes all parallel work on one file. Schema version lives in `migrations.ts`. Split into shared + per-domain instead (Phase C4). |
| Ownership matrix as a human-maintained document | **REJECTED (as doc); ACCEPT (as machine-checked gate)** | Agent-driven repo: human ceremony is violated every other PR. The boundary-check script (Phase A3) + ESLint `no-restricted-imports` (aspirational, needs dependency approval) machine-check the boundary. The ownership matrix in doc 04 is the *specification* the gate enforces, not a process document. |
| Remove `@google/genai` without checking skills usage | **DEFERRED** | Verify no skill uses it at dev time first (doc 08 §6). |

---

## 6. Decision register

Every compromise of a standing invariant must be recorded here with: date, decision, rationale, owning decision-maker, expiry/review date. **Empty as of this recording** — no invariant has been compromised.

| Date | Decision | Rationale | Owner | Review |
| :--- | :--- | :--- | :--- | :--- |

---

## 7. Target verification harness (the gate that makes the plan safe)

The plan is only as safe as the harness that proves each step preserved behavior. The target harness (built incrementally, starting in Phase A):

1. **CI workflow** (`ci.yml`) — `npm test` + `npm run lint` + `npm run build` on every PR + push. (Phase A1, implemented.)
2. **Boundary-check script** (`check_layer_boundaries.ts`) — machine-checks the three-layer boundary. (Phase A3, implemented.)
3. **Duplicate-migration-version guard test** — LR-A11. (Phase A4, implemented.)
4. **Golden-replay harness** (target, not yet built) — for each `scripts/make_*_save.ts` fixture, run every action against v11, assert byte-identical `JSON.stringify(world)` before/after a refactor. Required before Phase E2.
5. **Screenshot diff harness** — headless Chromium at 1440×900 + 390×844 against `download/asset-qa/` baselines. Required for any scene change (Phase B2, E3, E4).
6. **`perfProbe` allocation assertion** — per-frame allocation count unchanged. Required for any tick/input change.
7. **Tag-on-merge** — every merge to main gets `git tag build-<N>-<sha>`. (Phase A2, implemented.)

The harness is the real "architecture" — the code structure follows from what the harness can prove safe.

---

This target is deliberately conservative. It does not rewrite working systems. It extracts, formalizes, and machine-checks. The ownership matrix (doc 04) assigns every module an owner; the dependency graph (doc 05) proves the boundary; the shared contracts (doc 06) make the implicit explicit; the protocol (doc 07) makes parallel work safe; the integration strategy (doc 08) implements Phase A now.
