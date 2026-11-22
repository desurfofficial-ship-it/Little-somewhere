# 03 — Target Reliability Model

**Status:** synthesized from the Phase One evidence base (docs 01–02, four independent specialist investigations, ~29,500-tick stress suite). Every contract below names the evidence that motivates it and the invariant that enforces it.

## 1. Journal lifecycle contract

**Lifecycle (as verified):** event source (action reducers / tick discovery grant) → append via `appendJournalMemory*` / exploration grant → prepend newest-first into `world.memories` (id-deduped at append) → UI projection (`JournalDrawer` reads all rows on commit) → `serializeWorldState` → load → `sanitizeMemories` (validate/dedup) → runtime.

**Classification:** `world.memories` is a **user-facing history projection, not authoritative state**. Verified: no gameplay logic reads rows for outcomes; the only semantics attached to row presence are (a) append dedup/idempotency guards and (b) two cottage-memento visual lookups. Simulation outcomes derive from `npcRelations`, `npcMemories`, `storylines`, `sideFlags` — all capped or bounded independently.

**Contract rules:**

| # | Rule | Invariant |
|---|---|---|
| J-1 | Every persisted collection is capped. New rule: `JOURNAL_MEMORY_CAP = 96` rows, enforced in `sanitizeMemories` (the single choke point every save and load already flows through) — an order-preserving deterministic head slice (the head is the newest rows in production order; for a non-conforming payload the head is whatever the payload's order is, and the warning says "first rows kept"). | No persisted collection grows without bound; all states, including hand-edited, converge on the cap at first save. |
| J-2 | Cap headroom must exceed the production content ceiling (≈58 static `mem_*` ids today) so trimming is never visible to production gameplay; dedup guards that key on row presence cannot change behavior for states the simulation produces. | Trim = structural bound, zero player-visible change today. |
| J-3 | Journal/memory ordering is newest-first, preserved exactly through serialize→load (verified round-trip). Timestamps/ids derive from world clock, never wall clock. | Deterministic ordering and ids. |
| J-4 | Read-key cache (`journal.readKeys`) is trimmed to its write-path cap (240) on load as well. | Write-path caps are load-path invariants. |
| J-5 | Lowering the cap below the content ceiling is permitted only after dedup guards and memento lookups are pinned to `sideFlags` unlock markers (documented follow-up; not required while cap = 96). | Future-proofing gate. |

**Rejected alternatives:** recent-entry retention + historical summaries (requires schema v12 bump and summary generation for zero current benefit — content-bound at 58 rows); separating authoritative event state from projection (no authoritative event consumer exists). Chosen: strict bounded retention — least complex solution that preserves the intended player experience.

## 2. Persistence contract

**Pipeline (verified order):** Live WorldState → `serializeWorldState` = `JSON.stringify(sanitizeWorldState(state))` (sanitize per save, on a copy) → persisted payload → `deserializeWorldState` → `migrateWorldState` (sequential v1→v11) → `sanitizeWorldState` → runtime WorldState. Backup+rewrite of the persisted payload when the load path upgraded the schema (existing rule) **and** when a same-version payload required default-reseeding (new rule, SR-9).

**Responsibility taxonomy (target):**
- *Normalization* (older valid schemas): deterministic field defaults during migration — must warn, must be idempotent.
- *Repair* (inconsistent-but-recoverable state): re-derive derived fields (trust from affinity, season from day, discovered-from-inventory), drop-and-warn for invalid optional records, clamp for window numerics — deterministic, warned, idempotent.
- *Boundary defense* (untrusted input): reference resolution and domain enforcement — unknown references are **dropped with a warning, never fabricated**; out-of-domain counters are **clamped or the record is archived/dropped, never silently accepted**; occupancy is anchored to a live active invitation and `activeActivity` is anchored to the live invitation (never to occupancy alone) — mismatches are cleared or re-derived per the shipped rules in doc 06 §3 and LR doc 14 §4.3. *(Wording corrected during the 2026-11-21 integration review, finding R1-P-03: this bullet previously retained the rejected "cleared as a unit" unit-clear language that the original initiative's adversarial review had replaced.)*
- Never: silently turn malformed data into apparently-valid state; fabricate records; nondeterministic repair.

**Domain rules (target sanitizer invariants):**

| Field | Domain | Violation behavior |
|---|---|---|
| Invitation window minutes | ⊆ [360, 1290], `start ≤ end` | clamp with warning |
| Invitation `expiresDay` | `=== offeredDay`, `1 ≤ offeredDay ≤ day` | set `expiresDay = offeredDay`; archive if past-expired per strict predicate |
| Invitation `offeredDay` | `≥ 1`, `≤ world.day` | archive/drop with warning |
| Occupancy + `activeActivity` | contract of record (doc 14 §4.3 / LR1-15b): `activeActivity` anchors to the LIVE ACTIVE INVITATION; occupancy requires a live accepted invitation + matching interior/station/invitation id | orphan `activeActivity` cleared + warning; inconsistent or unanchorable occupancy cleared + warning (AR-1/AR-1b closed the silent outer drop); occupancy missing its slice RESTORED deterministically from the accepted invitation + warning (SR-2b) |
| `npcRelations` keys | both halves registered residents | drop pair + warning |
| Storyline keys | registry storylines | drop + warning |
| Occupancy `stationId` | registered station | clear field + warning |
| Occupancy `facing` | finite number (a numeric angle in production — not an enum; the audit's enum framing was corrected in the review round) | reject/normalize + warning when non-finite |
| Counters (`day`, `bellRungCount`, `familiarity`, …) | finite + floor; **ceilings only where production writers have them**: affinity −50..100, reliability 0..100, tension 0..100, `dailyAffinityGained` 0..20. `day` / `familiarity` / `bellRungCount` are legitimately unbounded by design (rejected generic ceilings — doc 02 §SR-5 disposition, AR-4 pin) | clamp/normalize + warning where the domain exists; accept unchanged (no invented warning) where the counter is unbounded-by-design |
| Encounter `endsMinute` | `≥ startedMinute` | normalize or drop + warning |
| Collection ids | unique per collection (`worldEvents`, `activeEncounters`, `invitations.history`, `memories`) | keep-first dedup + warning |
| Journal entry ids | non-empty, production-shaped | drop entry + warning |
| Schema version | integer ∈ [1, 11] | unknown (non-integer/negative) → reject to fresh + warning; **future (> 11) → conservative degraded load + tombstone backup, never rewritten** + warning (SR-9e) |

**Round-trip guarantees (verified baseline, to be protected by regression tests):** `serialize(load(serialize(x)))` byte-stable across repeated cycles; `sanitize` idempotent; no progressive drift or accumulation; semantic equality = deep equality under the game's own normalization-aware comparator.

## 3. State ownership contract

- **Creators:** `createFreshWorldState` (and migration/sanitization on load) are the only sources of a runtime `WorldState`.
- **Production path:** `stepSimulationInPlace` mutates the app-owned world **by design and by contract**; the app frame loop owns `worldRef.current`; React-visible identity changes only in `commitWorld`.
- **Pure path:** `stepSimulation` must return a state whose mutable leaves never alias the input's — including `residents` (SR-10 fix: per-resident shallow record clone). Callers may retain the input world across pure steps without cross-contamination; save-revision fingerprints of a retained input may not change as a side effect of stepping a derived state.
- **Reducers:** copy-on-write (verified across the reducer surface — 7 probes clean); intentional in-place writers are confined to `*InPlace` symbols called from the tick engine and are documented as such.
- **Serialization/deserialization:** non-mutating (verified); no load-induced aliasing between a loaded state and the payload object.
- **Test fixtures:** created per scenario via the real creation functions; never shared mutable across independent runs; purity regression test enforces the boundary so future tick writers cannot reopen the class.

## 4. Determinism contract (verified, preserved by mandate)

No `Math.random` / `Date.now` / `performance.now` in the `src/game/` tick graph; all stochasticity through the seeded RNG (`rng.ts`); tick iterates fixed `RESIDENT_ORDER`; save-hash sorts key sets; identical seed + identical initial state ⇒ byte-identical final state and serialized output (verified 12,000 ticks × both paths, plus stress replay scenario). **No correction in this initiative may touch the tick graph's arithmetic or ordering.**

## 5. Long-run simulation invariants (checked per tick and per save/load by the stress harness)

1. Every persisted reference resolves (invitation participants, relations, occupancy, stations, storylines).
2. Ids unique within every collection.
3. Numeric domains hold (finite, floors, ceilings, cross-field).
4. Occupancy/`activeActivity` unit coherence.
5. Invitation lifecycle transitions valid per the strict predicate (never accepted-without-offer, never expired-then-accepted).
6. Journal/memory ids unique + rows domain-valid (ordering is enforced by construction at the single newest-first append path and verified by the save/reload round-trip tests; the harness asserts uniqueness + day-validity + byte-stable replay, not append-order monotonicity — doc 08 §3).
7. No unbounded growth where a bounded policy exists (caps engage exactly).
8. Deterministic replay: twin runs byte-identical; save/load cycles drift-free.
9. No unexpected mutation of retained inputs on the pure path.

**Baseline result:** zero hard violations across ~29,500 ticks and 8 scenarios — the harness becomes a committed regression tool so this stays true.

## 6. Save/load guarantees

Supported older saves remain loadable (sequential migrations); new saves round-trip byte-stably; invalid saves are handled safely (reject-to-fresh for unrepresentable versions; deterministic repair otherwise); no silent loss of valid historical data (trims/drops are warned and capped-collection-specific; production content never crosses the trim line).

## 7. Error handling policy

- The load boundary **never throws** for malformed content (verified: 0 throws across 32 adversarial fixtures) — it classifies: accept / normalize+warn / repair+warn / drop-record+warn / reject-to-fresh+warn.
- All repair/normalization/drop decisions emit exactly one classified warning; per-step migration warnings are merged into the load result (AR-3 closed the v1/v3 paths); production surfaces them on console (no gameplay UI dependency) — **identically on the save path** (`serializeWorldState` takes a warnings sink and otherwise console.warns repairs; healthy saves are silent — AR-5).
- Warning text reflects the actual path taken (no stale "v7" copy).

## 8. Performance expectations

| Path | Budget | Basis |
|---|---|---|
| Steady tick (in-place) | ≤ 10 µs, size-independent | measured 5–7 µs; unchanged by this initiative |
| Pure wrapper | ≤ 50 µs (+≤1 µs residents clone) | measured 48.5 µs; clone ≈ 0.43 µs @ N=10 |
| Save at cap (96 rows) | ≤ ~1 ms serialize, ≤ ~40 KB payload | measured n=100 profile: 0.41–0.59 ms / 38.6 KB |
| Save worst case (uncapped hand-edited input) | bounded by first-save convergence to cap | compaction measured ≈ 0 ms cost |
| Load | ≤ ~0.7 ms typical | measured 0.30–0.63 ms @ 100–800 rows |
