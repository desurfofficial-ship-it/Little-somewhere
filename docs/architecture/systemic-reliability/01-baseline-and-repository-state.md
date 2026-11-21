# 01 — Baseline and Repository State

**Initiative:** SYSTEMIC RELIABILITY INITIATIVE — LITTLE SOMEWHERE
**Branch:** `feat/systemic-reliability` (dedicated initiative branch)
**Recorded:** 2026-11-21
**All statements below are first-hand verifications performed on the checked-out tree, not inherited reports.**

## 1. Verified repository state

| Item | Verified value |
|---|---|
| Initiative worktree | `/home/z/my-project/little-somewhere-sri` (linked worktree; original checkout untouched) |
| Branch point | created from verified `origin/main` = `545e323` |
| HEAD at baseline | `545e323` — `docs(recovery): complete doc 14 merge outcome + post-merge verified addendum (PR #5 merged as 5681eec)` |
| Remote | `origin` = `github.com/desurfofficial-ship-it/Little-somewhere` (public read; no embedded credential in remote URL) |
| Working tree | clean (`git status --porcelain` = 0 entries) at initiative start |
| Stashes | none |
| Worktrees | original checkout (`feat/lr1-implementation` @ `d615a8e`) + this initiative worktree only |
| Untracked artifacts | none |

### Historical integration anchors — verified against actual remote state

| Reported historical state | Verification result |
|---|---|
| PR #5 merged as `5681eec` | CONFIRMED — `5681eec` is on `origin/main`; GitHub API: PR #5 `state=closed, merged=true`, head `a2200eb`, title "Restore Build-10 exploration and reconcile Living Relationships" |
| Subsequent documentation commit `545e323` | CONFIRMED — current `origin/main` tip |
| Resulting `origin/main` = `545e323` | CONFIRMED at fetch time (2026-11-21); `git ls-remote origin` HEAD and `refs/heads/main` both `545e323cada…` |
| Prior main tip `4ad2e5f` (LR-1/LR-2) | CONFIRMED still an ancestor of `origin/main` — history preserved, nothing rewritten |

### PR status (directives: do not close or modify PR #3; do not alter PR #5 history)

- **PR #5:** closed and merged (`5681eec`). Untouched by this initiative.
- **PR #3:** head `refs/pull/3/head` = `d615a8e`, still present on remote; `d615a8e` is **not** an ancestor of `origin/main`; `refs/pull/3/merge` present (GitHub maintains merge refs for open PRs). The API status lookup hit an anonymous rate limit at inspection time, so open/closed is recorded as *almost certainly open, unmerged*. **PR #3 was not read-modified-closed-touched in any way by this initiative.** The initiative branch was cut from `origin/main`, not from PR #3's branch; the two do not interact.
- Other remote branches observed (`feat/botanical-dressing-micro-life`, `feat/visual-identity-evolution-build-01`, `fix/build10-lr-reconciliation`, `review/lr1-test-first`): unrelated; untouched.

### Local branch hygiene

- Local `main` (`52e2e33`) is stale relative to `origin/main`; intentionally **not** moved (initiative policy: don't manage unrelated branches).
- `backup-build9-ed6b8c9`, `build7-morning-bake-alternative`, `review/lr1-test-first`: unrelated, untouched.

## 2. Baseline verification results (reproduced on `545e323`, Node v24.22.3, Linux sandbox)

| Command | Result |
|---|---|
| `npm run lint` (`tsc --noEmit`) | exit 0, **0 errors** |
| `npm test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`) | **425/425 pass**, 0 fail / 0 cancelled / 0 skipped (duration ≈16.1 s) |
| `npm run build` (`vite build`) | exit 0; bundle 1,707.92 kB (gzip 474.14 kB); only pre-existing >500 kB chunk-size advisory |

Dependency install note: `npm install` fails with an esbuild peer-range conflict (`vite@8.3.8` wants `esbuild@^0.27||^0.28`; root declares `esbuild@^0.25`); `npm ci` from `package-lock.json` succeeds and the toolchain works (esbuild 0.25.12 hoisted, tsx 4.23.15). The repo also carries a `bun.lock`. Recorded as environment context, not a defect.

## 3. Existing architectural boundaries (as found, verified by direct reading)

- **Headless deterministic simulation** lives in `src/game/` (pure TypeScript, no React/Three imports in the tick graph). Production drives it exclusively through `stepSimulationInPlace` (`src/game/simulation.ts:606`), called once per frame from `src/scene/NeighborhoodCanvas.tsx:2121`. The pure wrapper `stepSimulation` (`src/game/simulation.ts:1050`) has **zero production callers** — every call site is a test (verified by grep: `storage.test.ts:26,347`, `cottage.test.ts:34,147`, `relationships.test.ts:16,204,205`, `simulation.test.ts` multiple).
- **World ownership in the app:** the frame loop mutates `worldRef.current` in place; React-visible state identity changes only through `commitWorld` (`src/App.tsx:271-274`). Autosave runs on a 5 s interval + flush points (`src/App.tsx:1110-1145`), never inside the frame loop.
- **Persistence pipeline:** save = `JSON.stringify(sanitizeWorldState(state))` (`src/game/storage.ts:45-47` — sanitize on every save, on a copy, non-mutating); load = parse → `migrateWorldState` (sequential v1→v11, `src/game/migrations.ts:2180-2228`) → sanitize (`migrations.ts:2234`); backup+rewrite of the persisted payload only when `migratedFromVersion < 11` (`storage.ts:70-77`).
- **Collection caps in production code** (all verified): `MAX_WORLD_EVENTS = 40` (`relationships.ts:19`), `MAX_ACTIVITY_HISTORY_PER_RESIDENT = 8` (`relationships.ts:20`), `MAX_NPC_MEMORIES_PER_RESIDENT = 14` (`memories.ts:33`), `INVITATION_HISTORY_CAP = 12` (`invitations.ts:25`), storyline notes cap 6 (`storylines.ts:11`). The only uncapped persisted collection is `world.memories` (see SR-1).
- **Invitation lifecycle:** one strict predicate `isInvitationLive` (D-03 unification); production window writer `computeOfferWindow` clamps to `[360,1290]` with `start ≤ end` (`invitations.ts:127-152`); `offerInvitation` sets `expiresDay = offeredDay = world.day` (`invitations.ts:233-234`).
- **Clock model:** no midnight wrap; `clampMinuteOfDay` caps at 1290 and the day boundary is clamp-dwell + `advanceToNextDay` (→ minute 480). Verified coherent across season changes in the stress harness.
- **Determinism:** no `Math.random`/`Date.now`/`performance.now` in the `src/game/` tick graph (`Math.random` exists only in `src/game/audio.ts`, outside the tick graph); tick iterates fixed `RESIDENT_ORDER` arrays; save-hash sorts key sets.

## 4. Relevant source files (initiative focus set)

| File | Role |
|---|---|
| `src/game/simulation.ts` | tick engine; pure wrapper + in-place production path; emotion writer |
| `src/game/actions.ts` | reducers (enter actions, invitations, activities, gifting, journal appends) |
| `src/game/invitations.ts` | invitation state machine, strict predicate, caps, window computation |
| `src/game/storage.ts` | serialize/deserialize/load/save, revision hashing |
| `src/game/migrations.ts` | schema migration chain v1→v11 and the load/save sanitizer |
| `src/game/journal.ts` / `src/game/memories.ts` | journal projection + NPC memories (caps) |
| `src/game/exploration.ts` | discovery grant path (journal/memories appends from the tick) |
| `src/game/types.ts` | WorldState schema (v11) |
| `src/App.tsx`, `src/scene/NeighborhoodCanvas.tsx`, `src/components/JournalDrawer.tsx` | app loop, commitWorld, autosave, journal UI consumption |

## 5. Known deferred findings (from `docs/architecture/build10-lr-recovery/12-final-corrective-engineering-verdict.md` §2 — exact file `12-final-corrective-engineering-verdict.md`)

F-UX-1, F-SIM-1, F-SAVE-1, F-SAVE-2, F-SAVE-3, F-ENTER-1, F-WORLD-1, F-ASSET-1, F-DOC-1, F-PRED-1 — carried into doc 02 for independent reproduction; dispositions re-derived from fresh evidence, not copied.

## 6. Reproduction results (summary — full detail in doc 02)

| Register ID | Reproduced on `545e323`? | Outcome |
|---|---|---|
| F-SAVE-3 | Yes (mechanism + scaling model) | `world.memories` uncapped; serialize fixed+linear ≈ 75–265 µs + 0.92–0.97 µs/row; payload 15,545 B + 212.1 B/row (R² ≥ 0.991). Absolute numbers ~25–33 % below the historical measurement (host variance); **reachability corrected**: production ceiling ≈ 58 rows (static content ids) — growth is content-bound, not time-bound |
| F-SIM-1 | Yes, exactly | first natural leak at pure step **682**; 4 mood paths leaked (`residents.{jun,toby,pip}.mood` @682, `residents.nora.mood` @983); sole boundary-crossing writer `updateResidentEmotionInPlace` (`simulation.ts:399-401`); production in-place path unaffected by design |
| F-SAVE-1 | Yes | `windowStart:-50 / windowEnd:1400` loads with **0 warnings**, invitation live all-day; range checks absent (`migrations.ts:1415-1422`) |
| F-SAVE-2 | Yes | `expiresDay: 1e9` immortal; occupancy `facing`/`localPos` finite-checked only (`migrations.ts:1550-1564`); `stationId` length-checked only |
| F-UX-1 | Yes (documented, not fixed) | `JournalDrawer` memo deps `[world, seenKeys]` (`JournalDrawer.tsx:52-55`); tick mutates in place; identity changes only in `commitWorld`; step-0 grant discarded (`simulation.ts:640`) |
| F-ENTER-1 | Yes (verified structurally) | only `enterNookAction` (`actions.ts:2960`, reconciliation at 2972-3006) reconciles invitation expiry on room entry; cottage/greenhouse/bakery/copperwheel enter actions have none |
| F-PRED-1 | Backstop verified airtight | stress harness: `staleInvitationSeen = 0` across ~29,500 ticks incl. invitation-pressure scenarios; nothing non-live survives even one tick |
| F-WORLD-1 | Not reproduced (QA-staging methodology note) | carried as documented; no code change justified |
| F-ASSET-1 | Present (pre-existing main-only asset work) | out of scope per register |
| F-DOC-1 | Historical record | preserved as written, per register |

**New findings beyond the register** (full detail in doc 02): SR-2 (sanitizer can mint an occupancy-cleared / `activeActivity`-surviving split), SR-3 (unknown `npcRelations` pairs fabricated as live relation data), SR-4 (unknown storyline keys fabricated as stage-12/active progress), SR-5 (no counter ceilings / temporal sanity), SR-6 (duplicate ids un-deduped in three collections), SR-7 (silent normalization / observability gaps), SR-8 (per-save sanitize cost is a full state rebuild), SR-9 (per-tick O(n) `memories` scan on the discovery-grant path), SR-10 (journal read-keys not re-trimmed on load), SR-11 (journal view rebuild cost while closed).

## 7. Performance baseline (Agent A benchmarks; Node v24.22.3; 3 independent runs; 30 samples / 10 warmups; real serializer + real append functions)

`world.memories` size → real save-path cost (`serializeWorldState`):

| Rows | Serialize median | Deserialize median | Payload | Repeated-save (10×) |
|---|---|---|---|---|
| 100 | 0.41–0.59 ms | 0.30 ms | 38.6 KB | — |
| 400 | ~0.6–0.7 ms | ~0.4 ms | ~88 KB | — |
| 800 | 0.75–0.88 ms | 0.63 ms | 185 KB | — |
| 1,600 | ~1.3–1.6 ms | ~1.1 ms | ~350 KB | — |
| 3,200 | 2.5–3.3 ms | 2.1 ms | 693 KB | — |
| 6,400 | ~5–6 ms | ~4 ms | ~1.35 MB | 67–70 ms per 10 saves |
| 12,800 | ~12 ms | ~9 ms | ~2.7 MB | — |

Scaling model: fixed + linear, fitted **0.92–0.97 µs/row** serialize; payload **+212.1 B/row** (R² = 1.0000 for payload). Raw `JSON.stringify` at 800 rows = 0.61 ms vs 0.88 ms full save path (sanitize rebuild overhead, SR-8). Steady tick cost 5–7 µs and size-independent; the only size-sensitive tick work is the discovery-grant scan (~8.5 ns/row, SR-9). Saves never run in the frame loop; at the historical 800-row point a save ≈ 4.5–5.3 % of one frame *if it did*. Compaction to a 96-row cap restores the n=100 profile exactly (serialize 0.17–0.26 ms, payload ≈39 KB).

## 8. Long-run stress baseline (Agent D harness; ~29,500 ticks across 8 scenarios, real production pathways)

| Scenario | Config | Ticks | Verdict |
|---|---|---|---|
| A extended ordinary life | seed 20260214 | 2,000 | PASS — zero hard violations |
| B persistence endurance | save/reload every 200 ticks + no-reload twin | 10,000 ×2 | PASS — twin byte-identical at every checkpoint |
| C journal pressure | clockRate 30, discovery warps | 2,000 (19 in-game days) | PASS — npcMemories saturate exactly at cap 140 |
| D/D2 invitation pressure | RNG offer/accept/decline/expire cycles | 2,000 + 2,000 | PASS — `INVITATION_HISTORY_CAP=12` engages and rolls over correctly |
| E boundary transitions | clamp-dwell + `advanceToNextDay` cycles | 2,000 (38 days) | PASS |
| F deterministic replay | A config ×2 separate worlds | 2,000 ×2 | PASS — firstDiffTick = null |
| G interrupted progression | 17× real `interruptSocialEncounter` + 10 save/reloads | 1,500 | PASS |

**Zero hard invariant violations** (references, duplicate ids, impossible values, stale occupancy, lifecycle transitions, journal ordering, caps) across the entire suite. Collection caps engage exactly where designed. Ticks-only runs append nothing to `world.memories` (register claim confirmed; one bounded exception: the discovery-grant path, registry-bound).

## 9. Initial risk classification

| Class | Items |
|---|---|
| Serious (correctness of the persistence boundary) | SR-2, SR-3, SR-4 (sanitizer can mint/admit state the simulation itself would never produce); SR-5, SR-6 (hardening of the same boundary) |
| Systemic (long-run scaling) | SR-1 (`memories` uncapped), SR-8 (per-save sanitize rebuild), SR-9 (per-tick scan) — today content-bounded, structurally unbounded |
| Purity (test-only today) | SR-12 (F-SIM-1 residents aliasing) + latent shared-slice inventory |
| UX freshness / non-blocking | SR-13 (F-UX-1), SR-14 (observability gaps), SR-10, SR-11 |
| No code change | F-WORLD-1, F-ASSET-1, F-DOC-1, F-PRED-1 (backstop verified; strict unification already landed) |
