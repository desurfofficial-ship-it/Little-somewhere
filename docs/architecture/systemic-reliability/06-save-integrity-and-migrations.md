# 06 — Save Integrity and Migrations

**Scope:** the persistence contract — pipeline order, sanitizer responsibility taxonomy, domain/reference/dedup rules, migration behavior, round-trip guarantees, and warning observability. Design of record: doc 03 §2, §6, §7. Corrections: commit `7a24293` (boundary hardening) plus the adversarial-review round (`AR-1..AR-5`, doc 09 §4).

## 1. Pipeline (verified order)

```
Live WorldState
  → serializeWorldState: sanitizeWorldState(state) [copy, non-mutating] → JSON.stringify
  → persisted payload (localStorage `little_somewhere_world_v1`)
  → deserializeWorldState: JSON.parse
  → migrateWorldState: sequential v1→v11 (each step pure; per-step warnings now merge into the load result, AR-3)
  → sanitizeWorldState
  → runtime WorldState
```

No operation mutates its input (pinned by test). Backup+rewrite of the persisted payload happens when the load path upgraded the schema **or** a same-version load repaired state (self-heal); a future-version payload is tombstoned (backed up) but **never rewritten** (SR-9e).

## 2. Responsibility taxonomy (as implemented)

- **Normalization (older valid schemas):** deterministic field defaults during migration — warned (AR-3 closed the last silent path: v1→v2 and v3→v4 per-step warnings now merge into the load result), idempotent.
- **Repair (inconsistent-but-recoverable):** re-derive derived fields (trust from affinity, season from day, discovered-from-inventory), clamp window numerics to the production offer domain, re-pin `expiresDay = offeredDay`, restore `activeActivity` from an accepted-invitation occupancy exactly as the production writer would (SR-2b) — deterministic, warned, idempotent.
- **Boundary defense (untrusted input):** reference resolution (unknown relation pairs, storyline keys, occupancy `stationId`s dropped with a warning, never fabricated), domain enforcement (clamp or clear-with-warning), unit coherence (occupancy/`activeActivity` per the contract of record below), keep-first duplicate collapse (worldEvents, activeEncounters, invitation history — SR-8; re-keyed relation-pair duplicates — AR-2), reject-to-fresh for unrepresentable schema versions.
- **Never:** silently turn malformed data into apparently-valid state; fabricate records; nondeterministic repair; reject a state the simulation itself produces (guarded by the GUARD fixtures + the 459-test suite + the harness's save/reload twins).

## 3. The occupancy / activeActivity rule (contract of record — read this before touching the sanitizer)

The adversarial loop during implementation **rejected** the audit's proposed unit-clear ("clear occupancy + activeActivity as one unit") against the documented decision of record: doc 14 §4.3 and doc 16 §3 (regression test LR1-15b) anchor `activeActivity` to the **LIVE ACTIVE INVITATION**, not to occupancy. The shipped rule is:

1. `activeActivity` requires a live active invitation with matching `activityId` (LR1-15b); an orphan is cleared **with a warning** — every time, observable.
2. Occupancy requires a live **accepted** invitation, matching interior/station/invitation id, finite numerics, interior `playerLocation`; inconsistent occupancy is cleared with a warning (SR-7); an occupancy that cannot be anchored (no live accepted invite, or exterior player) is cleared **with a warning** (AR-1/AR-1b — previously silent, fixed in the adversarial round).
3. An occupancy whose `activeActivity` slice is missing is **completed deterministically** from the accepted invitation (SR-2b, restore-with-warning) — production-writer-shaped, never fabricated from nothing.
4. A mid-visit `activeActivity` survives load without occupancy (recovery contract of record; pinned by SR-2a green test whose red-phase counterpart asserted the rejected unit-clear).

## 4. Domain rules (as implemented; full table in doc 03 §2)

| Field | Enforced behavior |
|---|---|
| Invitation window minutes | clamp to `[360, DAY_END_MINUTE]`, `start ≤ end`, warn (F-SAVE-1) |
| Invitation `expiresDay` | `=== offeredDay` (re-pin + warn); archive if past-expired per strict predicate (F-SAVE-2) |
| Invitation `offeredDay` | `≥ 1`, `≤ world.day`; future-dated → active cleared, no history fabricated (SR-5 test) |
| Encounter `endsMinute` | `≥ startedMinute` else drop + warn (SR-9a) |
| `npcRelations` keys | two registered residents; unknown pairs dropped + warned (SR-3); non-canonical spellings re-keyed via `getNpcPairKey` + warned; **re-key collisions collapse keep-first + warned (AR-2)**; gameplay-created pairs of registered residents remain valid |
| Storyline keys | registry storylines only; unknown dropped + warned, never minted as progress (SR-4) |
| Occupancy `stationId` | resolves to the activity station registry, else clear + warn (SR-7 test) |
| Counters | finite + floor + **production-derived ceilings only**: affinity −50..100, reliability 0..100, tension 0..100, `dailyAffinityGained` 0..20. `day` / `familiarity` / `bellRungCount` are **legitimately unbounded in production** (doc 02 §SR-5 disposition, AR-4 pin) — imposing sanitizer ceilings would corrupt legitimate long saves |
| Occupancy `facing` | finite number (a numeric angle in production — the audit's "direction enum" framing was corrected in docs; AR-4-adjacent doc fix) |
| Collections | keep-first id dedup: worldEvents, activeEncounters, invitation history (SR-8a/b/c), memories (existing); collection caps per doc 01 §3 |
| Journal memory rows | valid shape + non-empty production-shaped ids, else drop + warn; cap 96 newest-first-head (SR-1) |
| Schema version | non-integer/negative → reject-to-fresh + warn (SR-9b); future (> 11) → conservative degraded load + tombstone, never rewritten (SR-9e) |

## 5. Warning topology (observability)

- The load boundary never throws for malformed content (32-fixture catalog: 0 throws).
- Every normalization/repair/drop emits exactly one classified warning; `loadWorldState` surfaces each on `console.warn` with the `[little-somewhere save]` prefix (doc 03 §7).
- **Adversarial-round completeness (AR round):** the three silent paths found by the independent reviewer now warn — occupancy outer drop (AR-1/AR-1b), legacy v1/v3 per-step migration warnings (AR-3, including the over-cap memories trim inside a v1 save), and the **save path** (AR-5: `serializeWorldState` repairs surface on `console.warn` when no explicit sink is passed; healthy saves are silent — pinned).
- Warning text reflects the actual path taken (no stale "v7" copy); the memories-trim text says "first rows kept" (AR-6 wording fix — the trim is an order-preserving head slice, not timestamp-aware).

## 6. Round-trip guarantees (verified)

- `serialize(load(serialize(x)))` byte-stable across repeated cycles for fresh, played (offer/accept/enter), and migrated-v1 states (pinned by GUARD tests + AR round ×3 cycles; re-verified independently by the reviewer).
- `sanitize` idempotent; a converged state re-saves with no trim warning (SR-1 save-path test).
- No progressive drift or accumulation (harness B-twin continuity: save/reload twin byte-identical to the no-reload twin at every checkpoint — doc 08).
- Semantic equality = byte equality under the pipeline's own normalization (all documented repairs converge on first load/save; the "repair-free loads keep the save fingerprint" test pins revision stability).

## 7. Migration behavior

- Sequential pure upgraders v1→v11; unknown/negative/fractional versions reject-to-fresh + warn; future versions load conservatively with tombstone backup (SR-9e, storage test pins "never rewritten").
- Old saves receive stable defaults for fields introduced after their version; supported older saves remain loadable (v1 fixture covered by tests; legacy warnings now observable — AR-3).
- No schema bump was needed for this initiative (no new fields; the cap is enforcement, not format).

## 8. Fixture catalog summary

`src/game/save-integrity.test.ts` — 33 tests: 3 GUARD fixtures (production-reachable states load warning-free and byte-stable), 24 defect-pinning fixtures (F-SAVE-1/2, SR-1..SR-9), 6 adversarial-review round tests (AR-1..AR-5). Red-first evidence: 20/26 failed on the un-fixed boundary at `7e6b056` (re-verified independently); AR round: 5 red → green after the fixes; AR-4 pins intended accept-behavior and was green by construction. Mutation evidence per test in doc 09 §5.
