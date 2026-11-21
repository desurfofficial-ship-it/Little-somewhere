# 05 — Journal Lifecycle and Performance

**Scope:** the complete lifecycle of `world.memories` (the Pocket Journal's Memories projection) and its persistence/performance characteristics. Design of record: doc 03 §1 (J-1..J-5). Baseline evidence: doc 01 §7, doc 02 §SR-1. Correction: `JOURNAL_MEMORY_CAP = 96` (commit `7a24293`), read-key symmetry (same commit), benchmark tooling `scripts/journal_bench.ts`.

## 1. Lifecycle model (traced end-to-end)

1. **Event sources** — action reducers (`actions.ts:458,1081,1412,1454`), activity completion (`activities.ts:219`), tick-path discovery grant (`exploration.ts:117` via `discoverExplorationInPlace`, called from `simulation.ts:640`).
2. **Append** — newest-first prepend into `world.memories`; every append site is id-deduped by a presence check (`memories.some(m => m.id === …)`); ids are static content ids or bounded families (`mem_teatable_{itemId}`, `mem_explored_*`), never wall-clock-derived.
3. **Consumption** — `JournalDrawer` reads all rows on commit (UI projection only); two cottage-memento visual lookups (`cottageInterior.ts` presence checks); presence-keyed append guards. **No gameplay outcome reads rows** — simulation outcomes derive from `npcRelations`, `npcMemories`, `storylines`, `sideFlags`, all capped or bounded independently (verified, doc 03 §1).
4. **Save** — `serializeWorldState` = `JSON.stringify(sanitizeWorldState(state))`; `sanitizeMemories` validates shape, dedups by id, enforces the cap.
5. **Load** — parse → sequential migrations v1→v11 (legacy steps now pass their warnings through, AR-3) → `sanitizeMemories` (validate/dedup/cap) → runtime.
6. **Retention** — none beyond the cap (strict bounded retention chosen; see doc 03 §1 for the rejected alternatives and why: no authoritative event consumer exists, and summary generation would require a schema bump for zero current benefit).

**Classification:** `world.memories` is a **user-facing history projection, not authoritative state**. Timestamps/ids derive from the world clock; ordering is newest-first by construction (single append path); the cap is enforced at the one choke point every save and load already flows through.

## 2. Production content ceiling (why 96 is invisible to gameplay)

Every append uses a static content id and dedups. Sweeping the append-path modules: ~43 distinct `mem_*` literals plus the bounded dynamic families (`mem_teatable_{itemId}` — the sippable-item set, `mem_explored_*` — 5 registry discoveries, `mem_side_*` legacy family) puts the producible ceiling at ≈58 rows (doc 01 §6 measured the same figure independently). **Headroom 96 > 58** ⇒ trimming never engages on any production-reachable state; the cap is a structural bound on hand-edited/out-of-envelope input and on future content growth, not a behavioral change. The harness asserts `memories.length ≤ 96` every tick across all scenarios (doc 08), and AR-4-style content sweeps keep the ceiling pinned.

Dedup guards keyed on row presence (`alreadyExists` checks) cannot change behavior for production states: trimming never removes a row that a future append-guard would look for while its content id is still producible within the 58-row ceiling. The J-5 gate (doc 03 §1) forbids lowering the cap below the ceiling until those guards are re-anchored to `sideFlags` markers.

## 3. Benchmarks

Methodology (identical to the doc 01 §7 baseline): Node v24.22.3, Linux sandbox; **3 independent runs, 30 samples per point after 10 warmups, medians reported**; real production pipeline only (`serializeWorldState` / `deserializeWorldState` including sanitize + migrate); `world.memories` populated with n synthetic uniquely-id'd valid rows; all other state fresh-world default. Tool: `scripts/journal_bench.ts` (committed; `npx tsx scripts/journal_bench.ts`).

### 3.1 Before the cap (baseline `545e323`, from doc 01 §7)

| Rows in | Serialize median | Deserialize median | Payload |
|---|---|---|---|
| 100 | 0.41–0.59 ms | 0.30 ms | 38.6 KB |
| 800 | 0.75–0.88 ms | 0.63 ms | 185 KB |
| 3,200 | 2.5–3.3 ms | 2.1 ms | 693 KB |
| 12,800 | ~12 ms | ~9 ms | ~2.7 MB |

Scaling model: fixed + linear, 0.92–0.97 µs/row, payload +212.1 B/row (R² ≥ 0.991). Unbounded by collection size.

### 3.2 After the cap (this branch, same methodology)

| Rows in (input) | Serialize median (3 runs) | Deserialize median | Persisted payload | 10× repeated save | Raw `JSON.stringify` of rows |
|---|---|---|---|---|---|
| 100 | 0.106–0.226 ms | 0.139–0.257 ms | 38.2 KB | 1.07–1.81 ms | 0.026 ms |
| 400 | 0.145–0.214 ms | 0.137–0.179 ms | 38.2 KB | 1.42–1.73 ms | ~0.105 ms |
| 800 | 0.194–0.222 ms | 0.138–0.170 ms | 38.2 KB | 1.81–2.17 ms | ~0.27 ms |
| 1,600 | 0.304–0.329 ms | 0.138–0.155 ms | 38.2 KB | 2.77–2.99 ms | ~0.55 ms |
| 3,200 | 0.484–0.507 ms | 0.135–0.145 ms | 38.2 KB | 4.91–5.16 ms | ~1.13 ms |
| 6,400 | 0.943–0.968 ms | 0.132–0.148 ms | 38.2 KB | 9.26–10.94 ms | ~2.36–3.00 ms |
| 12,800 | 1.813–1.927 ms | 0.130–0.166 ms | 38.2 KB | 18.45–20.55 ms | ~4.57–6.37 ms |

**Steady state at the cap (96 rows):** serialize median 0.125 ms (min 0.117 / max 0.138 across runs), payload 38.2 KB — matching the doc 03 §8 budget (≤ ~1 ms, ≤ ~40 KB).

### 3.3 Scaling behavior explained (honest reading)

- **Persisted payload and deserialize are size-independent after the fix.** Whatever the input, the persisted collection converges to 96 rows on first save (SR-1 save-path rule, pinned by test), so serialized size is flat at 38.2 KB and load cost is flat at ~0.14 ms.
- **Serialize retains a linear term in the *input* size** (~0.14 µs/row on this host: the sanitizer's validation sweep runs before the head-slice trim). This matters only for a hand-edited or otherwise out-of-envelope in-memory state; a real game state never holds more than 96 rows in memory after load, so steady-state saves sit at ~0.12 ms. The linear term is the cost of validating untrusted input once — after the first save/load convergence it is never paid again.
- **The unbounded-growth what-if** (raw `JSON.stringify` column) is shown for comparison: without the cap, per-row payload cost (+212 B/row baseline) and repeated-save cost would grow linearly forever; with the cap the repeated-save cost at any input size is bounded by that single validation sweep.

### 3.4 Fixed-point / convergence checks (from the same tool)

- Serialize of a 12,800-row input → persisted `memories.length = 96`, ids `mem_bench_00000..00095` (head kept, order preserved).
- `serialize(deserialize(serialize(x)))` byte-stable; fresh world round-trips byte-stably (17,763 B).
- A converged state re-saves with **no** trim warning (pinned by the SR-1 save-path test).

## 4. Retention decision

**Strict bounded retention** (doc 03 §1) — `JOURNAL_MEMORY_CAP = 96`, enforced in `sanitizeMemories`, order-preserving head slice (head = newest rows in production order; the trim warning says "first rows kept" after the adversarial-review wording fix, AR-6). Evaluated against the alternatives in doc 03 §1; selected because it is the least complex option that preserves the player experience: the projection is content-bound at ≈58 rows, so the cap is invisible today and bounds only the structurally-unbounded tomorrow.

## 5. Dispositions recorded here (details in docs 09/11)

- **SR-13 (read-key symmetry):** `JOURNAL_READ_KEYS_CAP = 240` exported and enforced on the load path as well (`journal.ts`); write path references the same constant (no duplicated literal).
- **SR-12 (per-tick O(n) discovery scan):** deferred (P3) — the cap bounds the scan to ≤ 96 rows ≈ ≤ 0.8 µs at the measured 8.5 ns/row (doc 02 §SR-12); keyed-index rework only if the cap is ever lowered (J-5).
- **SR-14 (closed-panel journal rebuild):** deferred (P3) — micro-optimization, no correctness impact.
- **Per-save sanitize rebuild** (the "full state rebuild per save" observation from the baseline investigation): measured and bounded — raw `JSON.stringify` vs full save path differs by the sanitize sweep (0.61 vs 0.88 ms at 800 rows baseline); at the cap the full save path is ~0.12–0.22 ms. Saves never run in the frame loop (5 s autosave interval + flush points, `App.tsx`), so the worst-case save cost is ≪ 1 % of frame budget amortized. Recorded here as understood-and-bounded rather than tracked as a defect.
