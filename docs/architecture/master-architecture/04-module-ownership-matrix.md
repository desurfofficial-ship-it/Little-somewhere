# 04 — Module Ownership Matrix

**Recorded:** 2026-11-22, atop `origin/main` @ `a80a220`.
**Purpose:** assign every subsystem exactly one owning team; define the "do not import" rules; define file ownership and change-management for shared files; specify the machine-checked enforcement.

**Principle:** this matrix is the *specification* the boundary-check script (`scripts/check_layer_boundaries.ts`, doc 08) enforces. It is not a human-maintained process document — in an agent-driven repo, human ceremony is violated every other PR. The matrix is authoritative because the gate machine-checks it.

---

## 1. Subsystem ownership

Each subsystem has **exactly one owning team**. The owning team is the only team that may modify the subsystem's defining modules. Other teams consume via the published contract (doc 06) only.

| Subsystem | Owning team | Defining modules (owner may edit freely) | Published contract (consumers depend on this) |
| :--- | :--- | :--- | :--- |
| **Simulation runtime** | Sim team | `simulation.ts`, `memories.ts`, `relationships.ts`, `residents.ts`, `npcRuntime.ts` (after B6) | `stepSimulationInPlace(world, dt, opts)` signature; `NpcRuntimeState` shape; `RESIDENT_ORDER`/`RESIDENTS` registries |
| **World state (the contract)** | Contract lead (architect) | `types.ts` (cross-layer portion only after C4) | `WorldState` v11 field→owner table (doc 06 §1) |
| **NPC runtime** | Sim team | `simulation.ts` (runtime), `npcRuntime.ts` (factory) | `createInitialNpcRuntime()`; `NpcRuntimeState` |
| **Relationship systems** | Sim team | `relationships.ts` | `applyNpcSocialRelationInPlace`, `pushWorldEventInPlace`, `getNpcRelation`; `PlayerNpcRelation`/`NpcNpcRelation` types |
| **Story & dialogue systems** | Narrative team | `storylines.ts` (+ `SideFlagKey`/`SIDE_FLAG_DEFINITIONS` registry after C1), `dialogueEngine.ts`, `narrative.ts`, `dialogue/index.ts` + leaf modules | `DIALOGUE_TOPICS` aggregator; `selectDialogueSession` signature; `STORYLINE_MAP` registry; `StoryFlags` owner map (after C2) |
| **Activities & interactions (LR)** | LR team | `invitations.ts`, `occupancy.ts`, `activities.ts` | `InvitationState`, `InteriorOccupant`, `ActiveSharedActivity` types; invitation lifecycle API |
| **Inventory & item systems** | Items team | `inventory.ts` (+ `items/types.ts` after C4) | `PERSONAL_ITEM_MAP`, `HEARTH_RECIPES`, `RESIDENT_GIFT_PREFS` registries; `PersonalItemId` |
| **World & environmental systems** | World team | `worldMap.ts`, `navigation.ts`, `walkability.ts`, `environment.ts`, `exploration.ts` | `NAV_NODES`/`NAV_EDGES`; `BOX_OBSTACLES`/`CIRCLE_OBSTACLES`; `composeEnvironmentState`; `EXPLORATION_DISCOVERIES`; `LANDMARK_ZONES` |
| **Interior definitions** | Interior team (per-interior sub-owners) | `cottage.ts`, `greenhouse.ts`, `bakery.ts`, `bookNook.ts`, `copperwheel.ts` (+ per-domain `types.ts` after C4) | Per-interior bounds/stations/day-cycle registries; `ProgressionReadModel` fields (doc 06 §3) |
| **Save/load & persistence** | Persistence team | `migrations.ts` (→ `persistence/migrations/*` after D1), `storage.ts` (→ `persistence/storage.ts`) | `CURRENT_SCHEMA_VERSION`; `migrateWorldState`; `sanitizeWorldState`; `loadWorldState`/`saveWorldState`/`advanceToNextDay`; `computeWorldSaveRevision` |
| **Reducers (actions)** | Action team (per-domain sub-owners) | `actions.ts` (→ `actions/*` after B1/E2) | The 47 exported reducer signatures; `PropInteractionResult` (moved to `types.ts` after B3) |
| **Player controller** | World team | `playerController.ts` | `stepPlayerMovement` signature; `PlayerPosture`/`PlayerLocation` |
| **UI & presentation** | HUD team | `App.tsx` (shell+commitWorld only after E1), `hooks/useGameActions.ts` (after E1), `components/*` | `commitWorld` funnel; HUD state snapshot shape; component prop contracts |
| **3D scene rendering** | Scene team | `NeighborhoodCanvas.tsx` (mount+tick after E3), `sceneAssembly.ts` (after E3), `inputDirector.ts` (after B2), `environmentRenderer.ts`, `progressionPresentation.ts`, `textures.ts`, `materials.ts`, `waterShaders.ts`, `models.ts`, `perfProbe.ts`, `contactShadows.ts`, `ambientSway.ts`, `residentFeel.ts`, `builders/*` | Rig type contracts (`GazeboRig`, `FountainRig`, `CharacterRig`, …); `MaterialPalette` API; `EnvironmentVisualController.update` |
| **Audio** | Audio team | `audio.ts` | `cozyAudio` singleton API; SFX method signatures |
| **Time & RNG** | Sim team | `time.ts`, `rng.ts` | `advanceSimulationClock`; `getSeasonForDay`; `getTimePhase`; `mulberry32`/`hashSeed` |
| **Testing infrastructure** | Integration lead | `scripts/check_layer_boundaries.ts` (A3), guard tests (A4), CI workflow (A1) | The gates themselves |

---

## 2. Shared files — change-management protocol

Some files are consumed by many teams but owned by one. Changes to these files are the highest-risk merge conflicts and the most likely to silently break consumers. They require the **shared-file change protocol** (doc 07 §4):

| Shared file | Owner | Consumers | Change rule |
| :--- | :--- | :--- | :--- |
| `src/game/types.ts` (cross-layer portion) | Contract lead | 105 importers | **Additive-only.** Never remove/rename an exported type without a deprecation cycle. New fields on `WorldState` require a migration step (doc 07 §2). Renaming a field requires updating every consumer in the same PR + a migration. |
| `src/game/migrations.ts` (→ `persistence/migrations/`) | Persistence team | `storage.ts`, tests | **Serialized schema bumps** (doc 07 §2). Parallel teams register their migration step via the protocol; the duplicate-version guard test (A4) prevents collisions. |
| `src/game/storage.ts` (→ `persistence/storage.ts`) | Persistence team | `App.tsx`, `actions.ts` | `computeWorldSaveRevision` changes require every persisted field to be covered (W2 remediation D3). |
| `src/game/narrative.ts` (stub) | Narrative team | `App.tsx`, `environmentRenderer.ts` | `computeEnvironmentState` is the environment-reactivity contract; changes ripple to scene. |
| `src/game/residents.ts` | Sim team | 42 importers | `RESIDENT_ORDER`/`RESIDENTS` additions are additive; removals break dialogue/sim/UI. |
| `src/game/worldMap.ts` | World team | 35 importers | `BOX_OBSTACLES`/`CIRCLE_OBSTACLES`/`NAV_NODES`/`LANDMARK_ZONES` changes ripple to scene builders + navigation. |
| `src/scene/materials.ts` | Scene team | 43 importers | `MaterialPalette` API + `STORYBOOK_PALETTE` are the scene's shared material contract. |
| `src/App.tsx` (after E1: shell+commitWorld) | HUD team | (consumed by React only) | `commitWorld` is the atomic funnel — adding a setter requires updating `handleResetAndStart` (or after E1, it calls `commitWorld` so no drift). |
| `WORKLOG.md` | All teams (append-only) | — | **Entry-number protocol** (doc 07 §5) — collisions have already happened (Entry 053/054/055). |
| `HANDOVER.md` | All teams | — | Update when architecture/storage keys/open backlog change (`AGENTS.md` §5). |

---

## 3. "Do not import" rules (machine-checked by `scripts/check_layer_boundaries.ts`)

These rules are the enforcement of `AGENTS.md` §2. The boundary-check script (Phase A3, doc 08) machine-checks them on every PR.

| Rule | Checked against | Enforcement |
| :--- | :--- | :--- |
| `src/game/**` must not import `three` | `import ... from 'three'` / `from 'three/...'` in `src/game/**` | CI fails |
| `src/game/**` must not import `react` / `react-dom` | `import ... from 'react'` / `'react-dom'` in `src/game/**` | CI fails |
| `src/game/**` must not touch browser globals except in sanctioned modules | `window.`, `document.`, `AudioContext`, `requestAnimationFrame`, `localStorage`, `fetch`, `Worker`, `indexedDB`, `navigator`, `performance.now` in `src/game/**` — **except** `storage.ts` (`window.localStorage`) and `audio.ts` (`AudioContext` + injected `Scheduler`) | CI fails; **`journal.ts` `window.localStorage` is a known violation (W5) — the script flags it until W5 is remediated, then the sanction list shrinks back** |
| `src/scene/**` must not import from `src/components/` | `import ... from '...components/...'` in `src/scene/**` | CI fails |
| `src/components/**` must not import `three` directly | `import ... from 'three'` in `src/components/**` | CI fails (only `NeighborhoodCanvas.tsx` may import three, and it lives in `src/scene/`) |
| `src/components/**` must not import from `src/scene/**` | `import ... from '...scene/...'` in `src/components/**` | CI fails (composition root is `App.tsx` only) |
| `src/game/**` must be acyclic (DAG) | Tarjan SCC on `src/game/**` import graph | CI fails if any multi-node SCC or self-loop appears |

**Sanctioned browser-touch modules (the only exceptions to the `src/game/` purity rule):**
- `storage.ts` — `window.localStorage` (guarded by `typeof window === 'undefined'`).
- `audio.ts` — `AudioContext` (lazy `ensureContext()` guard). After W6 remediation, `window.setTimeout`/`clearTimeout` move behind an injected `Scheduler` port.

**Aspirational (requires dependency approval per the initiative boundaries):** an ESLint `no-restricted-imports` rule encoding the above, replacing the standalone script. The standalone script is dependency-free and ships now; ESLint is a future enhancement (doc 08 §3 note).

---

## 4. File ownership rules

1. **A module's defining file is owned by its subsystem's owning team.** Other teams do not edit it; they file a cross-team dependency request (doc 07 §6).
2. **Test files are owned by the team that owns the system under test.** A team may add tests for its own subsystem freely; tests that cross subsystem boundaries (integration tests) are owned by the Integration lead.
3. **Adding a resident / interior / storyline / item** touches multiple subsystems — follow `AGENTS.md` §5 (the "Adding New Content Safely" checklist) and the cross-team dependency register (doc 07 §6).
4. **Doc files under `docs/architecture/master-architecture/`** are owned by the Contract lead (architect). Other teams may propose edits via PR but the architect merges.
5. **`scripts/`** QA/bench scripts are owned by the Integration lead. Feature-specific save-fixture scripts (`make_*_save.ts`) are owned by the feature team that introduced them.

---

## 5. Change-management procedure

| Change type | Procedure |
| :--- | :--- |
| **Additive to an owned module** (new exported function/type/registry entry within the subsystem) | Owning team edits freely; CI gates. |
| **New field on `WorldState`** | Schema-bump protocol (doc 07 §2): register a migration step, add to sanitizer, add to revision hash, bump `CURRENT_SCHEMA_VERSION`. The duplicate-version guard test (A4) prevents collisions. |
| **Edit a shared file** (doc 04 §2) | Shared-file change protocol (doc 07 §4): PR description must list every consumer affected; CI + the relevant guard test must pass; reviewer from each affected team signs off (or the architect waives). |
| **Cross-subsystem feature** (e.g., adding a resident: types + residents + narrative + actions + scene + dialogue) | Cross-team dependency register entry (doc 07 §6) filed before work starts; one team coordinates, others review the contract surfaces. |
| **Architecture change affecting multiple teams** | Architect review before implementation (this directory). The architect owns doc 03 §6 Decision register. |
| **New dependency** | **Blocked** without strong justification + explicit architect approval (initiative boundary). |

---

## 6. Enforcement summary

| Gate | Mechanism | Implemented |
| :--- | :--- | :--- |
| Three-layer boundary | `scripts/check_layer_boundaries.ts` run in `ci.yml` | **Yes (this initiative)** |
| DAG invariant (no cycles in `src/game/`) | Tarjan SCC in `check_layer_boundaries.ts` | **Yes (this initiative)** |
| Duplicate migration version | Guard test in `migrations.test.ts` (A4) | **Yes (this initiative)** |
| Tests green | `npm test` in `ci.yml` | **Yes (this initiative)** |
| Types green | `npm run lint` (`tsc --noEmit`) in `ci.yml` | **Yes (this initiative)** |
| Build green | `npm run build` in `ci.yml` | **Yes (this initiative)** |
| Branch durability | `git tag build-<N>-<sha>` on merge to main | **Yes (this initiative)** |
| Golden-replay (for Phase E2) | Target harness (doc 03 §7) | Not yet (Phase E prerequisite) |
| Screenshot diff (for scene changes) | Existing `scripts/qa_*_evidence.sh` + headless Chromium | Partial — formalize in Phase B2 |

---

The matrix is enforced by machines, not by humans reading a document. That is the only enforcement that survives an agent-driven repo.
