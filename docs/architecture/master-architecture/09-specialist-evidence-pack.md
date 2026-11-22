# 09 — Specialist Evidence Pack

**Recorded:** 2026-11-22, atop `origin/main` @ `a80a220`.
**Purpose:** the consolidated raw findings from the six parallel specialist investigations (Tasks 1-a..1-f) that ground docs 01–08. Kept for auditability — every claim in docs 01–08 traces to evidence here. Citations are `file:line` against the actual `main` tree.

This pack is condensed from the full specialist reports (each ~1800–2500 words). The headline findings, evidence tables, and rankings are preserved verbatim; prose is tightened.

---

## Task 1-a — Architecture Researcher

**Mission:** map the actual runtime architecture as it exists in code; identify structural weaknesses that block parallel multi-team development.

### Headline findings
- **Three-layer claim holds at file-system level** with one boundary leak: `src/game/journal.ts:47,202,205,224,226` directly touches `window.localStorage` under key `little_somewhere_journal_read_v1` — not in the sanctioned list (`storage.ts`, `audio.ts`). Opens a second, un-migrated persistence channel.
- **`types.ts` is the canonical contract**: 1012 LOC, **105 importers** (75 production), zero re-exports elsewhere. The one drifted interface: `PropInteractionResult` lives in `actions.ts:162`, consumed by `DialogueSheet.tsx:59`.
- **`prototypes/willowLaneDiorama.ts` (1722 LOC) is NOT orphaned** — production code misfiled. Imported by `NeighborhoodCanvas.tsx:110-114` for the player cottage/mailbox/courtyard.

### Monolith decomposition map (the extraction plan evidence)
- **`actions.ts` (4035 LOC, 47 exported functions, 21 imports):** 6 logical sub-domains (dialogue choice 199–954; sit&sip 955–1112; world props/gifting 1113–1230 + 3556–4035; exterior landmarks 1261–2107; cottage 2108–2399 + 3556–3775; greenhouse 2157–2663; bakery/nook/copperwheel 2664–3555). `interactWithProp` (1261–1870, ~610 LOC) is a sub-monolith dispatching on 20 `PropInteractableId` literals — natural registry candidate.
- **`NeighborhoodCanvas.tsx` (2750 LOC, 43 imports):** scene assembly 541–1110; characters+raycast 1112–1289; input/A*/tap-to-walk 1290–2300; tick() 2300–2750.
- **`migrations.ts` (2487 LOC, 15 exports):** chain 1978–2412 (~440 LOC); `sanitizeWorldState` 1203–1977 (~770 LOC); `createDefaultWorldState`+`createStarterMemories` 236–305.
- **`App.tsx` (1546 LOC):** 18 `handle*` dispatchers at 326–1148; `commitWorld` at 272–284.

### Cross-cutting concern smearing (the parallel-dev killers)
| Concern | Files mutating/reading | Severity |
| :--- | :--- | :--- |
| `world.flags` (StoryFlags) | 10 files (actions, narrative, simulation, dialogue/everyday, dialogue/interiors/copperwheel, environment, journal, playerController, migrations, storage) | high |
| `world.sideFlags` (untyped bag) | 9 files, **no owning module** | **critical** |
| `world.storylines` | 10+ files (storylines, actions, dialogueEngine, simulation, narrative, 5 personal arcs + 2 event arcs) | medium |
| `world.npcMemories` | 5 files (memories, actions, simulation, dialogueEngine, journal) | medium |

### Top weaknesses (1-a's ranking)
1. `actions.ts` merge-conflict bottleneck (4035 LOC, 47 reducers)
2. `NeighborhoodCanvas.tsx` couples assembly+input+tick (2750 LOC, 43 imports)
3. `sideFlags` un-owned un-typed string bag
4. `StoryFlags` mutated by 10 modules, no ownership map
5. `App.tsx` mixes shell + 18 dispatchers; `handleResetAndStart` drift outlier
6. Two persistence channels (journal.ts ghost localStorage)
7. `migrations.ts` glues chain+sanitize+defaults (2487 LOC)
8. `dialogue/personal/*` + `dialogue/events/*` mutate `storylines` inline

---

## Task 1-b — Lifecycle Specialist

**Mission:** investigate initialization order, frame/update lifecycle, event flow, system ownership.

### Boot sequence (ordered, with file:line)
1. `index.html:21-24` → 2. `main.tsx:1-5` → 3. `App.tsx:162` mount; **`useState(() => loadWorldState())` at `:167` runs migration+sanitize synchronously during render, before `worldRef` exists** → 4. `App.tsx:1213-1232` renders `<NeighborhoodCanvas>` → 5. `NeighborhoodCanvas.tsx:377` `useEffect(..., [])` runs once: WebGLRenderer+Scene+PMREM (`471-499`), rigs (`1128-1168`), **lazy `worldRef.current.npcRuntime = createInitialNpcRuntime(...)` at `1138-1142` (bypasses commitWorld; dead code — sanitizer always populates)**, `syncVisualAndHud` frame-0 (`2672`), first render (`2674-2680`), `requestAnimationFrame(tick)` → 6. first sim tick `2193 tick()` → `2243 stepSimulationInPlace` → 7. first HUD snapshot ~5.5 Hz (`hudSyncAccum >= 0.18` at `2164`).

### `commitWorld()` audit
**Definition `App.tsx:272-284`**: atomic React-side funnel (`worldRef` swap + `setWorldSnapshot` + 7 HUD setters + dirty stamp + `saveWorldState`). **Atomic for user-intent mutations.** Autonomous sim/locomotion mutations (`npcRuntime`, `activeEncounters`, `worldEvents`, `npcActivityHistory`, `npcMemories`, `npcRelations`, `occupancy`, `activeActivity`, `playerPos/facing/posture`, exploration `sideFlags`/`memories`) are in-place ~60×/sec, persisted only by 5s autosave + `pagehide`. **Documented and by-design**, but React `worldSnapshot` is ~166ms behind canvas.

**Direct-mutation bypasses found:** `NeighborhoodCanvas.tsx:1138-1142` (npcRuntime lazy init, dead code), `:2420-2423` (player locomotion, by design), `simulation.ts:400` (`residents[id].mood` in-place — dual-owned with actions spread; pure wrapper at `1068-1072` defends it), `exploration.ts:115-128` (sideFlags+memories in-place from sim tick — dual-writer with actions spread), `invitations.ts:384-413` (expireInvitationsInPlace from sim).

### Determinism audit — verified pure
No `Math.random()` in `simulation.ts` (only `mulberry32(hashSeed(...))` at `:924`). No `Date.now()`/`performance.now()` in any `src/game/` module. `Math.random()` only in `audio.ts` (synth, isolated) and `NeighborhoodCanvas.tsx:1101-1106` (visual jitter, never touches `worldRef`). dt clamp `simulation.ts:611` (0.25s) + scene `:2197` (0.05s). Clock never auto-rolls day (`time.ts:32-34` clamps at 1290).

### Ownership conflicts (lifecycle)
| State slice | Writers | Risk |
| :--- | :--- | :--- |
| `sideFlags` | actions (spread) + exploration (in-place) + storylines (in-place) | **HIGH** — overwrite-on-spread hazard |
| `residents[id].mood` | simulation (in-place) + actions (spread) | MEDIUM — pure wrapper defends |
| `memories` | actions (prepend) + exploration (in-place) | MEDIUM — dual discipline |
| `occupancy`/`activeActivity` | invitations (in-place from sim) + actions (spread) | MEDIUM |

### Top lifecycle risks
1. `sideFlags`/`memories` dual-discipline writers (exploration in-place vs actions spread)
2. `residents[id].mood` in-place vs spread
3. `commitWorld` atomicity is React-only; sim mutations not atomic (5s autosave backstop)
4. Day never auto-rolls (idle at 9:30 PM freezes clock)
5. `handleResetAndStart` reimplements commitWorld setters inline (drift risk)
6. Lazy npcRuntime init bypasses commitWorld (dead code today)
7. Scene-level Math.random() makes visual replay non-deterministic (sim is fine)
8. `SceneErrorBoundary` does not remount on HMR
9. `stepPlayerMovement` in-place mutation → HUD up to 166ms behind
10. SwiftShader afterDraw fence degrades sim dt to ~80ms ticks

---

## Task 1-c — Data & Persistence Specialist

**Mission:** audit state management, save schema, migration integrity, persistence contracts.

### WorldState v11 schema (condensed — full table in doc 06 §1)
34 top-level fields across v1–v11. `DialogueSession` is runtime-only (not persisted). Caps verified: `memories` 96, `npcMemories[id]` 14 (6 permanent), `worldEvents` 40, `npcActivityHistory[id]` 8, `invitations.history` 12, `cottageState.displayedKeepsakeIds` 5, `greenhouseState.plots` 4, `inventory` MAX_ITEM_STACK 20. `npcRelations` has **no explicit count cap** (relies on C(N,2) from registered-resident filter).

### Migration chain
`migrateWorldState` (`migrations.ts:2412-2487`): detect version → imperative `if (version === N) { working = migrateVNToV_{N+1}(working); version = N+1 }` ladder → final `sanitizeWorldState`. **No registry; no fast-forward.** v11 save skips the ladder; v1 save runs all 10 steps every load. All steps pure + idempotent; **no reversibility**. `migrateV3ToV4` is the most complex (~250 LOC, reconstructs npcMemories from story flags + journal + worldEvents).

### Serialization & integrity
`serializeWorldState = JSON.stringify(sanitizeWorldState(state))` — no replacer/reviver. **Revision hash** (`computeWorldSaveRevision`, FNV-1a-style 32-bit) is a **dirty stamp only, NOT embedded in payload** — no integrity check on the wire. Sanitization warnings are **console-only in production** (`saveWorldState` calls `serializeWorldState(state)` with no warnings sink).

### Save bloat — bounded
Veteran save ~18.9KB (day 13); worst-case "every resident at MAX_NPC_MEMORIES" ~76.5KB; 25-resident extrapolation <220KB. localStorage 5MB budget has ~65× headroom. **No compaction needed — caps enforce steady-state.**

### Parallel schema-evolution — MAJOR RISK (the four merge-points, doc 06 §2)
1. `CURRENT_SCHEMA_VERSION` integer (`migrations.ts:137`)
2. `migrateV{N}ToV{N+1}` function name + ladder slot (`:2472-2475`)
3. `sanitizeWorldState` monolithic return literal (`:1482-1529`, ~330 lines)
4. `computeWorldSaveRevision` hash (`storage.ts:145-498`) — new field not added → autosave never fires on its changes (silent data loss)

### Cross-subsystem derived reads (the implicit contracts, doc 06 §3)
`cottageInterior.ts:1906-1910` reads `greenhouseState.totalHarvests`, `bakeryState.kneadingSessions`, `nookState.booksRead`, `memories` ids. `progressionVisuals.ts:379-384` reads nook/greenhouse/bakery. `journal.ts:917-1008` reads all four interiors. **HANDOVER claim that cottage derives from `copperwheelState` is inaccurate** — copperwheel surfaces only in journal text + revision hash, not cottage visuals.

### Season/determinism — verified
Season is derived, calendar-locked (`sanitizeWorldState:1348-1360` overwrites persisted season with `getSeasonForDay(day)`; `time.ts:36-51` pure). Save replay byte-identical (fixed key order + tests `storage.test.ts:137-143`, `save-integrity.test.ts:137-153`).

---

## Task 1-d — Dependency Specialist

**Mission:** map the module dependency graph, find coupling, circular dependencies, boundary violations.

### The DAG — zero cycles
Tarjan SCC over 159 nodes / 764 edges → **159 single-node SCCs, 0 multi-node, 0 self-loops**. Re-verified production-only (97 nodes / 439 edges) → 97 single-node SCCs. **`src/game/` is a strict DAG.** The suspected `actions ↔ narrative ↔ simulation ↔ relationships ↔ memories ↔ storylines` cycle does NOT exist — it is a one-directional fan-in tree.

### Layer boundaries — clean with two violations
- `src/game/` → `src/scene/`: **0 imports** ✓
- `src/scene/` → `src/game/`: extensive, one-way ✓
- `src/components/` → `three`: **0 direct** ✓
- `src/components/` → `src/scene/`: **0** ✓ (`App.tsx` is the only composition root)
- **Violations:** `journal.ts:202-226` (`window.localStorage`, HIGH); `audio.ts:402,466,468` (`window.setTimeout`/`clearTimeout`, MEDIUM — outside AudioContext guard scope)

### Fan-out top 5: `NeighborhoodCanvas.tsx` (39), `dialogue/index.ts` (23), `App.tsx` (22), `actions.ts` (21), `migrations.ts` (17).
### Fan-in top 5: `types.ts` (105/75 prod), `materials.ts` (43/~35), `storage.ts` (42/~12), `residents.ts` (42/~30), `worldMap.ts` (35/~20). **`actions.ts` fan-in 22 but only 2 production importers** (`App.tsx`, `DialogueSheet.tsx` for one type) — inflated by tests; it is a leaf sink, not a coupling hub.

### `actions.ts` coupling — leaf reducer, correctly positioned
21 outbound imports; 2 production importers; no cycle risk. `PropInteractionResult` (`actions.ts:162`) is the one drifted interface.

### Shared mutable singletons
`cozyAudio` (`audio.ts:472`, module-level singleton), `_otherPositions` (`simulation.ts:65`, scratch), 6 `let` caches (`progressionVisuals.ts:170-173,451-452`), scratch vectors in `NeighborhoodCanvas.tsx:221-226` + `environmentRenderer.ts:22-65`. `MaterialPalette` is instance-scoped (good design). High-fan-in registries (`RESIDENTS`, `NAV_NODES`, `STORYLINE_MAP`, …) are all `readonly`.

---

## Task 1-e — Performance Specialist

**Mission:** identify architectural (not micro) performance bottlenecks and structural scaling risks.

### Frame-loop allocation audit — discipline holds with two violations
Module-scope scratch correctly hoisted (`NeighborhoodCanvas.tsx:221-227`, `environmentRenderer.ts:22-65`). **Violations:** `environmentRenderer.ts:742-746` + `:755-760` allocate fresh options-object literals every frame (`{ butterfliesActive, beesActive, windStrength }` etc.) — the only real zero-GC violation in the hot loop. `NeighborhoodCanvas.tsx:2180` `playerPos: { ...world.playerPos }` shallow clone at ~5.5Hz HUD sync (acceptable — throttled).

### Render scene-graph budget
InstancedMesh batching aggressive (vegetation 3 batches × 46 = 138 trees; orchard 4 batches; wilds ~10 batches; weather rain 48 + petals 24; contact shadows bucketed). `MaterialPalette` deduplication + `customProgramCacheKey`. **Weakness:** `builders/characters.ts` creates ~50–80 individual `THREE.Mesh` per rig (eyes, nose, freckles, hair, buttons, hands). 10 residents ≈ 600–800 loose meshes. **Full build ~1,800–2,500 Object3D nodes, ~35–45 InstancedMesh batches, ~400–600 draw calls.**

### Sim-step complexity — O(N²·E), bounded
Per-resident O(N); separation O(N²) (90 ops at N=10); encounter pairing O(N²) pairs × O(E) inner scan (E ≤ 40, `worldEvents.some()` at `simulation.ts:922`). `maxConcurrentEncounters = max(2, N/4)` early-exit bounds actual encounters. Gossip fires only on encounter creation (≤1176 ops, MAX_GOSSIP_PER_ENCOUNTER=1). **Breakpoint ~80–120 residents** where O(N²) pairing becomes measurable; the `worldEvents.some()` linear scan is the first hotspot (replaceable with `Set<string>`).

### Memory/dialogue/save cost
Memory lookups O(14) capped (effectively O(1)); HANDOVER allocation-free claim verified for per-frame path. Dialogue selector O(T log T) on dialogue open only (not per-frame). Save serialization: 5s autosave + double full-state iteration (revision hash + JSON.stringify) when dirty; <100ms today, doubles as state grows.

### HUD throttle — verified ~5.5Hz
`hudSyncAccum >= 0.18` at `NeighborhoodCanvas.tsx:2164`; edge triggers on nearestKey/bubbleKey/posture/heldItem/location/weather/season. `handleHudSync` batches 7 setStates into one re-render. Not 60Hz.

### Software-WebGL — robust, gameplay-neutral
Detection `NeighborhoodCanvas.tsx:401-410` (probe canvas, `UNMASKED_RENDERER_WEBGL`, regex, `loseContext()` release). Fallback visual-only: `antialias: !isSoftwareGl`, pixel ratio 1, shadows off, reduced particles, `afterDraw(tick)` fence pacing. **No gameplay alteration** (honors AGENTS.md).

### Scaling breakpoint — render breaks first
At 5× content (50 residents, 20 interiors): **character draw calls break first (~30–40 residents on mobile)** — fix via `mergeGeometries` for static sub-parts. Sim O(N²) breaks at ~80–120. Save at ~60–80. Memory never (cap holds).

### Top perf risks
1. Character rigs ~50–80 loose meshes each (draw-call scaling)
2. `world.worldEvents.some()` O(E) per candidate pair in O(N²) loop
3. Per-frame options-object allocation in environmentRenderer
4. Double full-state iteration on dirty autosave
5. O(N²) encounter pairing, no spatial partitioning
6. `computeSaveStamp` runs full hash every 5s even when idle

---

## Task 1-f — Adversarial Architecture Reviewer (RED TEAM)

**Mission:** challenge the obvious proposals; find second-order risks; stress-test the integration strategy.

### Three facts that reframe the brief
1. **`@google/genai` is a phantom dependency** — declared in `package.json` but imported nowhere in `src/`+`scripts/`+`skills/`. `GEMINI_API_KEY` is dead config. Not a runtime SPOF.
2. **`commitWorld` lives in `App.tsx:272`, not `actions.ts`** — `actions.ts` reducers are pure functions returning `{nextWorld, toast}`. "Decomposing actions.ts fragments commitWorld" is misframed — but the real risk (shared private helpers + multi-domain action ordering) stands.
3. **There is no CI test/lint workflow** — `.github/workflows/` has only `deploy-pages.yml` (build-only, main-only, no tests, no lint, never on PRs). The lost-branch incident is primarily a worktree-durability + process gap, secondarily a CI gap.

### Adversarial verdicts on the 7 proposals
| Proposal | Verdict | Rationale (one line) |
| :--- | :--- | :--- |
| P1 Decompose `actions.ts` | **DEFER (partial)** | Extract leaf domains (copperwheel/nook/greenhouse) only; keep multi-domain actions until golden-replay test exists. |
| P2 Decompose `NeighborhoodCanvas.tsx` | **DEFER** | Already half-extracted to `builders/*`; remaining 2750 lines are tick/input director that must stay single-context for zero-alloc. Extract input layer only. |
| P3 Split `migrations.ts` | **DEFER** | Per-version files behind re-export, NOT dynamic registry (breaks determinism); build duplicate-version guard test FIRST (LR-A11, unfixed). |
| P4 Ownership matrix + dep graph | **REJECT (as doc); ACCEPT (as machine-checked gate)** | Bureaucratic overhead unenforceable in agent-driven repo; replace with ESLint `no-restricted-imports` / boundary script. |
| P5 Event bus / mediator | **REJECT** | Destroys deterministic replay + single-reducer model; existing `composeEnvironmentState` poll is cheaper, deterministic, shipped. |
| P6 Add CI gates | **ACCEPT (highest priority)** | No CI test/lint workflow exists; add `ci.yml` on PRs + tag-on-merge for durability. Highest-leverage action. |
| P7 Freeze `types.ts` | **DEFER (split, don't freeze)** | Split into shared + per-domain; skip versioning ceremony (schema version lives in migrations.ts). |

### Blind spots of specialists 1-a..1-e
- **Process reality:** agent-driven repo; human-only ceremony (ownership matrix, ADRs, review boards) won't be followed. Gates must be machine-checked.
- **GitHub Pages deploy contract:** `force_orphan: true` destroys history (no rollback); `peaceiris/actions-gh-pages@v4` third-party; main-only deploy ships broken main directly to public.
- **Phantom `@google/genai`:** not a runtime SPOF; install-time liability + misleading env var.
- **WORKLOG numbering collision already happened:** Entry 053/054/055 collided; Entry 056 documents reconciliation.
- **`narrative.ts` modularization already underway:** `dialogue/` exists with subdirectories; 419-line `narrative.ts` is now a stub.

### Parallel-integration failure modes (concrete)
- Schema version collision (`migrations.ts:137` + `migrateV10ToV11`)
- WORKLOG entry collision (already happened, Entry 053/054/055)
- `types.ts` merge conflict (69 importers; union additions don't auto-merge)
- Dialogue content ordering (`dialogue/index.ts` spread order → selector priority)
- Save-schema field addition (sanitizer whitelist rebuild drops unknown fields silently)
- `EnvironmentVisualController` rig race (two teams claim same storyFlag key)

### The lost-branch incident — root cause + cheapest fix
Reliability work lived in a separate worktree on a branch not pushed to a remote durable ref → GC'd when worktree lost. **Primarily worktree-durability + process, secondarily CI.** Fix: (1) tag every merge to main (GC-proof), (2) add `ci.yml`, (3) record "no branch is durable until pushed + tagged." ~1 hour. **Implemented in this initiative (doc 08).**

### Non-negotiables (must not trade away)
1. Deterministic save replay
2. Save integrity via sanitizer whitelist
3. Three-layer boundary
4. Atomic `commitWorld`
5. Zero per-frame allocations in `tick()`
6. No history rewrite
7. (added by Master Architect) Clean DAG — no back-edges

### Final verdict: ACCEPT P6 (CI gates); DEFER P1/P2/P3/P7 (partial/split); REJECT P4-as-doc + P5.

**"The one thing to do this week: add `.github/workflows/ci.yml` and a `git tag` step on main merges. Everything else is downstream of having a gate to verify it against."** — Implemented in this initiative.

---

## Cross-specialist consensus (what all six agreed on)

1. **The three-layer boundary holds** (with two violations: `journal.ts`, `audio.ts` timer scope).
2. **`src/game/` is a clean DAG** — zero cycles, Tarjan-verified.
3. **`types.ts` is the canonical contract** — 105 importers, no fragmentation.
4. **`actions.ts` is a leaf reducer**, correctly positioned — its problem is size/merge-conflict, not coupling.
5. **`sideFlags` is the single biggest parallel-dev hazard** — un-owned, un-typed, 9 mutators.
6. **The four merge-points serialize parallel schema work** — the structural reason LR-3+ is hard to parallelize.
7. **No CI test/lint workflow is the highest-leverage gap** — the lost-branch incident's secondary cause.
8. **Deterministic save replay is load-bearing and must not be broken** by a dynamic registry or event bus.
9. **Decomposition must be gated by guard tests** — extract leaf domains first; multi-domain actions wait for a golden-replay harness.
10. **Gates must be machine-checked** — human ceremony doesn't survive an agent-driven repo.

---

This evidence pack is the audit trail. Docs 01–08 are the synthesis. The foundation infrastructure (doc 08 §10) is the implementation of Phase A.
