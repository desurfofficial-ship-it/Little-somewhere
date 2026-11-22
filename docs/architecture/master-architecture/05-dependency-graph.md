# 05 — Dependency Graph

**Recorded:** 2026-11-22, atop `origin/main` @ `a80a220`.
**Method:** Tarjan SCC + fan-in/fan-out analysis over the full `src/` import graph (159 nodes / 764 import edges), produced by Task 1-d (doc 09 §4). Adjacency artifacts: the analysis is reproducible by scanning `import ... from` statements across `src/`.

---

## 1. The verified DAG — zero circular dependencies

**Tarjan SCC over 159 nodes / 764 edges → 159 single-node SCCs, 0 multi-node, 0 self-loops.** Re-verified on the production-only subgraph (97 nodes / 439 edges) → 97 single-node SCCs. **`src/game/` is a strict DAG.** This is the codebase's strongest structural property and a standing invariant (doc 00 §"Standing invariants" #7).

The suspected cycle `actions ↔ narrative ↔ simulation ↔ relationships ↔ memories ↔ storylines` **does not exist**. The actual direction is a one-directional fan-in tree:

```
actions.ts      → narrative, relationships, memories, storylines (one-way; no back-edge)
narrative.ts    → dialogueEngine, dialogue (index), residents, types
simulation.ts   → relationships, memories, storylines, invitations, exploration,
                   navigation, worldMap, time, rng, residents
memories.ts     → inventory, relationships, residents, rng, time, worldMap
relationships.ts → residents, types          (leaf-ish)
storylines.ts   → types                      (pure leaf)
```

**No back-edge to `actions.ts` or `narrative.ts` from any sim/narrative module.** `actions.ts` is correctly a **terminal reducer / leaf sink** — it sits at the top of the DAG, fed by `App.tsx` and read by `DialogueSheet.tsx` (for one interface).

---

## 2. Layer boundaries — verified one-way

| Direction | Imports found | Verdict |
| :--- | :--- | :--- |
| `src/game/` → `src/scene/` | **0** | ✓ Clean |
| `src/scene/` → `src/game/` | extensive, read-only | ✓ One-way consumption |
| `src/components/` → `three` | **0 direct** (only string-literal matches in dialogue text) | ✓ Clean |
| `src/components/` → `src/scene/` | **0** | ✓ Clean (composition root is `App.tsx` only) |
| `src/App.tsx` → both `src/game/*` and `src/scene/NeighborhoodCanvas` | yes | ✓ `App.tsx` is the composition root |

**Two real boundary violations** (doc 02 W5, W6):

| File:line | Symbol | Severity | Notes |
| :--- | :--- | :--- | :--- |
| `src/game/journal.ts:47,202,205,224,226` | `window.localStorage` | **HIGH — undocumented violation** | `loadJournalRead()`/`saveJournalRead()` bypass the `storage.ts` boundary. Ghost un-migrated persistence channel (W5). |
| `src/game/audio.ts:402,466,468` | `window.setTimeout` / `window.clearTimeout` | **MEDIUM — exception-scope creep** | `audio.ts` exception was `AudioContext` only; timer scheduling exceeds scope (W6). |
| `src/game/storage.ts:79,82,101,106,502,505` | `window.localStorage` | OK (sanctioned) | Guarded by `typeof window === 'undefined'`. |
| `src/game/audio.ts:4,12,16` | `AudioContext` | OK (sanctioned) | Lazy `ensureContext()` guard. |

**No `three`, `react`, `react-dom`, `requestAnimationFrame`, `fetch`, `Worker`, `indexedDB`, `navigator`, `performance.*` hits in `src/game/`** (grep-verified). The documented rule holds with the two exceptions above, both of which the boundary-check script (doc 08 §3) now flags.

---

## 3. Fan-out top 10 (modules importing the most intra-src deps)

| # | Module | Imports | Significance |
| :--- | :--- | :--- | :--- |
| 1 | `src/scene/NeighborhoodCanvas.tsx` | 39 | God renderer; fan-out highest in repo. Decomposition target (W8). |
| 2 | `src/game/dialogue/index.ts` | 23 | Aggregator — by design (23 module spreads). Leaf modules import nothing upstream. |
| 3 | `src/App.tsx` | 22 | Composition root — by design. Dispatchers extractable (W4). |
| 4 | `src/game/actions.ts` | 21 | Leaf reducer; correctly imports its dependencies. Decomposition target (W3). |
| 5 | `src/game/migrations.ts` | 17 | Imports every subsystem for sanitize/migrate. Split target (W2/D1-D2). |
| 6 | `src/scene/environmentRenderer.ts` | 15 | Expected — orchestrates all visual sync. |
| 7 | `src/game/journal.ts` | 14 | Narrative projection; reads many subsystems for summaries. |
| 8 | `src/game/storage.ts` | 13 | Persistence; reads every field for revision hash. |
| 9 | `src/game/simulation.ts` | 11 | Sim core; expected. |
| 10 | `src/game/playerController.ts` / `src/scene/builders/copperwheelInterior.ts` | 9 each | Expected. |

---

## 4. Fan-in top 10 (most imported modules — the shared contracts)

| # | Module | Importers (incl. tests / prod-only) | Significance |
| :--- | :--- | :--- | :--- |
| 1 | `src/game/types.ts` | 105 / **75** | **The canonical shared contract.** Zero re-exports elsewhere. Split target (C4) to keep cross-layer portion lean. |
| 2 | `src/scene/materials.ts` | 43 / ~35 | Scene material contract; instance-scoped `MaterialPalette` (good design). |
| 3 | `src/game/storage.ts` | 42 / ~12 | Persistence API. |
| 4 | `src/game/residents.ts` | 42 / ~30 | Resident registry. |
| 5 | `src/game/worldMap.ts` | 35 / ~20 | World geometry contract. |
| 6 | `src/game/dialogueEngine.ts` | 28 / ~3 | Dialogue selector; receives `DIALOGUE_TOPICS` by injection (good — does not import the index). |
| 7 | `src/game/inventory.ts` | 23 / ~12 | Item registries. |
| 8 | `src/game/time.ts` | 22 / ~12 | Clock utilities. |
| 9 | `src/game/actions.ts` | 22 / **2** | **Only 2 production importers** (`App.tsx`, `DialogueSheet.tsx` for one type). The 22 rank is inflated by tests. Confirms it is a leaf sink, not a coupling hub. |
| 10 | `src/game/bookNook.ts` | 21 / ~6 | Interior registry. |

**Key insight:** `actions.ts` ranks #9 by fan-in *only because of tests*. In production it is consumed by exactly 2 files. It is **not** a coupling hub — it is correctly positioned as a terminal reducer. Its problem is size/merge-conflict (W3), not coupling.

---

## 5. `actions.ts` coupling map (detail)

- **Imports (21, all `./...`):** `activities, bakery, bookNook, copperwheel, cottage, environment, greenhouse, inventory, invitations, memories, narrative, occupancy, playerController, relationships, residents, storage, storylines, time, types, walkability, worldMap`.
- **Production importers:** `src/App.tsx:88` (value/code), `src/components/DialogueSheet.tsx:59` (**type-only**: `import { PropInteractionResult }` — the interface at `actions.ts:162`).
- **Verdict:** leaf sink; no cycle risk; the only "call-back" edges are outbound (actions → narrative/sim's neighbors), all one-way.
- **Smell:** `PropInteractionResult` (a cross-layer interface) lives in `actions.ts:162` instead of `types.ts` — drags a 4035-line module into a UI component's dep graph. **Fix: B3** (move to `types.ts`).

---

## 6. `types.ts` shared-contract verdict — canonical, with one drift

- `src/game/types.ts` is a **pure leaf** (zero imports). Imported by **75 production files** (105 incl. tests) — #1 fan-in by an order of magnitude.
- **No `export ... from './types'` re-exports anywhere** in `src/game/` or `src/scene/`. Types are **not** fragmented through barrels.
- The **only** contract re-export in the whole game layer: `narrative.ts:387 export { DIALOGUE_TOPICS }` — re-exporting a *value* (not a type) from `dialogue/index.ts:41`. Backwards-compat shim per docstring at `narrative.ts:379-387`.
- **One drifted type:** `PropInteractionResult` declared in `actions.ts:162`, consumed by `DialogueSheet.tsx`. Should be in `types.ts` (B3).

**Verdict:** types contract is **canonical**; the one drifted interface + the one value re-export are the only fragmentation. Both are small, fixable surgically.

---

## 7. Dialogue module aggregation verdict — clean

`src/game/dialogue/index.ts` aggregates **22 topic modules** (everyday ×5, personal ×5, quest ×3, events ×3, interiors ×5, invitations ×1) plus a `type` import. Exports exactly one constant: `DIALOGUE_TOPICS` (`dialogue/index.ts:41`).

- `narrative.ts:20` imports `DIALOGUE_TOPICS from './dialogue'` (the index).
- `narrative.ts:394` passes `DIALOGUE_TOPICS` **as a function argument** to `selectDialogueSession(...)` in `dialogueEngine.ts`. → `dialogueEngine.ts` does **not** import the dialogue index; it receives topics via dependency injection.
- The 22 leaf topic modules import **nothing** from upstream game/ (zero `from '../...'` matches).
- `dialogue/assets.ts` (portraits/subject images) is a separate leaf imported by 5 components — content-only, no topic coupling.

**Verdict:** single source of truth; engine receives topics via DI rather than import. This is the best-organized content surface in the repo. The `narrative.ts:387` re-export is the one redundancy (B5: mark `@deprecated`).

---

## 8. Shared mutable singletons register

| Singleton | Location | Scope | Risk | Remediation |
| :--- | :--- | :--- | :--- | :--- |
| `cozyAudio` | `audio.ts:472 export const cozyAudio = new CozyAudioEngine()` | Module-level singleton, mutable `ctx`, `hearthPopTimer`. Imported by `App.tsx:100`. | LOW — single consumer; testing must `.stopAll()` between cases. | Add factory + `useCozyAudio()` context provider for test injection (non-breaking). |
| `_otherPositions: Vec2[]` | `simulation.ts:65` | Module-scope scratch; reused via `.length = 0` in per-resident separation loop (`:742-748`). | MEDIUM — implicit shared scratch; reentrancy would clash. Acceptable only because JS is single-threaded + sim ticks serialized. | Document; no change needed. |
| 6 `let` caches in `progressionVisuals.ts` | `:170-173, 451-452` | Memoization by signature across `summarizeResidentTokens`/`summarizeKeepsakeEchoes`/`summarizeProgressionVisuals`. | MEDIUM — invalidation by signature; divergent callers thrash each other's cache. | Convert to class instances with per-consumer cache (W16). |
| `_vec3A/_vec3B/_raycaster/_pointer/_groundPlane` | `NeighborhoodCanvas.tsx:221-226` | Module-scope scratch. | LOW — single-file scope. | None (load-bearing for zero-alloc). |
| 15+ `THREE.Color` scratch | `environmentRenderer.ts:22-65` | Module-scope, reused per frame. | LOW — single-file scope. | None (load-bearing for zero-alloc). |
| `_seasonDriftTarget` | `botanicalDressing.ts:117` | Single Color scratch. | LOW — file-local. | None. |
| `STORYBOOK_PALETTE` | `materials.ts:240` | `export const` object literal — read-only by convention. | LOW (contract). | Document as read-only. |
| `MaterialPalette` (class) | `materials.ts:91` | Instance per consumer (`NeighborhoodCanvas.tsx:570 new MaterialPalette()`). Mutable cache inside instance, not module scope. | NONE (instance-scoped — good design). | None. |
| `EXPLORATION_FLAG_KEYS = new Set(...)` | `exploration.ts:81` | Derived, frozen-by-convention. | NONE. | Use as template for `SIDE_FLAG_DEFINITIONS` (C1). |

**Shared read-only registries (high fan-in, immutable):** `RESIDENTS`, `RESIDENT_ORDER`, `NAV_NODES`, `STORYLINE_MAP`, `PERSONAL_ITEM_MAP`, `GREENHOUSE_CROP_MAP`, `COPPERWHEEL_PROJECT_MAP`, `NOOK_BOOK_MAP`, `STORYBOOK_PALETTE`. All `readonly` record/reduce-derived lookups — these are **contracts**, not state. No mutations found (`push/splice/[i]=` searches returned zero hits against the registries).

---

## 9. Coupling-risk register (ranked for parallel dev)

| # | Risk | Evidence | Remediation (non-rewriting) |
| :--- | :--- | :--- | :--- |
| 1 | `types.ts` universal contract but `actions.ts` leaks one shared interface | `actions.ts:162` ← `DialogueSheet.tsx:59` | B3: move `PropInteractionResult` → `types.ts`. |
| 2 | `actions.ts` 4035-line reducer with 21 inbound deps + 22 test importers | fan-out 21 (#4); 22 test files import it | Extract `actions.contracts.ts` (types) consumed by impl + tests; leaf-domain extraction (B1). |
| 3 | `storage.ts` boundary leak — `journal.ts` reaches into `window.localStorage` | `journal.ts:202-226` | W5: `JournalReadStoragePort` injected by `App.tsx`. |
| 4 | `audio.ts` exception-scope creep — timers outside AudioContext guard | `audio.ts:402,466,468` | W6: inject `Scheduler` port. |
| 5 | `NeighborhoodCanvas.tsx` 39-fan-out composition monster | fan-out 39 (#1) | B2: extract `inputDirector.ts`; E3: extract `sceneAssembly.ts`. Pass `SceneServices` bag. |
| 6 | `cozyAudio` true module-level mutable singleton | `audio.ts:472` | `useCozyAudio()` context provider for test injection. |
| 7 | `progressionVisuals.ts` 6 module-scope `let` caches | `:170-173, 451-452` | W16: class instances with per-consumer cache. |
| 8 | `DIALOGUE_TOPICS` re-exported from `narrative.ts:387` despite canonical source | `dialogue/index.ts:41` defines; `narrative.ts:387` re-exports | B5: `@deprecated`, migrate importers. |
| 9 | `storage.ts:15` imports `simulation.ts` (`createInitialNpcRuntime`) — persistence→sim coupling | `storage.ts:15` | B6: extract `npcRuntime.ts` leaf; `simulation.ts` re-exports. |
| 10 | `migrations.ts` 17-fan-out god-importer | `migrations.ts:41-135` | D1-D2: per-version files + per-subsystem sanitizer dispatch. |

---

## 10. How to reproduce this graph

The DAG, fan-in/fan-out, and boundary analyses are reproducible by:
1. Scanning `import ... from` statements across `src/**/*.ts(x)`.
2. Resolving relative + `@/` alias imports to absolute file paths.
3. Running Tarjan SCC on the adjacency list.
4. Counting fan-out (out-edges per node) and fan-in (in-edges per node).
5. Grep `src/game/**` for the boundary-violation patterns (§2).

The boundary-check script (`scripts/check_layer_boundaries.ts`, doc 08 §3) encodes steps 2–5 and runs in CI. The full graph reproduction (step 1–4) is a one-off analysis command; formalizing it as a CI-checked "coupling budget" is a future enhancement (doc 03 §7).

---

This graph is the evidence that the three-layer boundary holds and the codebase is a clean DAG. The ownership matrix (doc 04) assigns every node an owner; the contracts (doc 06) bind the high-fan-in edges; the protocol (doc 07) governs changes to the shared files at the top of the fan-in table.
