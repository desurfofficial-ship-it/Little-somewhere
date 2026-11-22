# 03 — Integration Decisions

## 1. Strategy comparison and selection (directive §9)

| Strategy | Correctness | Conflict risk | Traceability | Reviewability | Regression risk | Rollback | Verdict |
|---|---|---|---|---|---|---|---|
| A. Merge reliability branch into a current-main-based branch | high | WORKLOG/HANDOVER conflict blobs entangle unrelated BUILD 02/03/04 history; merge-commit diff hard to separate from main-side divergence | good | poor (mixed diff) | medium | hard (merge commit) | rejected |
| B. Cherry-pick all 9 commits in order | high | confined to 2 history files | excellent (per-commit `-x` provenance) | high (each change is its own reviewable commit) | low | easy (revert individual picks) | **selected (mechanics)** |
| C. Reconstruct a smaller set as fresh commits | medium | none | poor (loses authorship; transcription risk on a 600-line sanitizer) | high | highest | easy | rejected |
| D. Hybrid: preserve coherent changes, adapt conflicts, omit obsolete work | high | low | high | high | low | easy | **selected (policy)** — implemented via B's mechanics |

**Selected: D, implemented through B.** All nine original commits cherry-picked in dependency order with `-x`; the only conflicts (WORKLOG.md / HANDOVER.md in `ec93aba` and `b71bb3c`) resolved deterministically to the integration branch's current content, with the reliability history reconciled in the integration's own record. This is the smallest coherent integration that preserves the original guarantees: zero transcription of code, full authorship/provenance, no obsolete code preserved merely to keep a nine-commit shape, and no valuable fix dropped to ease the merge. When a reliability fix could have been already present on current main, equivalence was proven before any omission — the audit found **no** fix already present on main (none of the five files had drifted), so nothing was omitted for that reason.

## 2. Conflict-resolution decision (history files)

Main independently acquired WORKLOG Entry 053 (BUILD 02), Entry 054 (BUILD 03), Entry 055 (BUILD 04) and HANDOVER §18 (BUILD 03 addendum) — the same identifiers the reliability branch used for its own records. Per the directive: no duplicate Entry 053/§18 appended, no casual renumbering of historical entries, no overwriting of either side. Resolution: the integration record takes the **next correct chronological identifiers on the integration base** — **WORKLOG Entry 056** and **HANDOVER §19** — and explicitly narrates the collision: which evidence belongs to the original branch (preserved verbatim in `docs/architecture/systemic-reliability/00-11` and in the untouched original branch), which belongs to this integration, and why an old pre-integration result (e.g. "459/459") must never be read as post-integration proof.

## 3. Design decisions taken during the integration

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Re-pin `expiresDay` to `offeredDay` stays (from the original work) | the sole production writer sets `expiresDay === offeredDay`; re-pinning is a no-op for valid saves and decays hand-edited "immortal" invites like every other offer | keeping hand-edited immortal invites (defeats SR-5) |
| Present-but-invalid `schemaVersion` claims (`null`, strings, booleans) reject-to-fresh (R1-P-02 repair) | the claim is authoritative-but-unreadable; the legacy v1 heuristic silently rebuilds v2-era slices of a modern payload (familiarity reset, gameplay-created pairs destroyed) with zero warnings; reject-to-fresh is the documented SR-9b contract and the raw payload is tombstoned first, so nothing is unrecoverable | treating the payload as v11 (invents a version claim; masks corruption); leaving it pre-existing-and-undocumented (violates the "no silent lossy load" contract) |
| Missing resident records mirrored as missing in the pure wrapper (R1-S-02 repair) | a fabricated `{}` diverges pure-vs-in-place on malformed fixtures and can accept a `mood` write production would skip; mirroring is exact | documenting the fabrication (leaves a behavioral divergence) |
| Non-record rows and truthy-garbage slices warn (R1-P-04 / R2-P-01 repairs) | the initiative's own "every drop warns" contract (doc 03 §7) had narrow holes | documenting the holes as exemptions (weaker than the shipped standard) |
| Keep the original branch's historical docs verbatim; add an attributed correction only where a doc contradicted shipped behavior (doc 03 §2 bullet, R1-P-03) | historical statements are preserved; contradictions are corrected with provenance, not silently rewritten | rewriting the original docs wholesale |

## 4. Explicit invariants carried by this integration

1. Every sanitizer drop, normalization, clamp, re-derivation, and restore emits a classified warning — on the load path **and** the save path (same sanitizer).
2. The raw persisted payload is tombstoned (backed up) **before** any rewrite; future-version payloads are backed up but never rewritten; a second load after repair is warning-free and byte-identical (fixed point).
3. Reference resolution never fabricates: unknown storyline keys, unregistered npcRelations pairs, non-record rows, mismatched `activeActivity` slices, unanchorable occupancy — dropped/cleared with warnings, never minted.
4. Dedup is deterministic keep-first across worldEvents, activeEncounters, invitation history, and re-keyed pair spellings.
5. Legitimately unbounded counters (`day`, `familiarity`, `bellRungCount`) stay unbounded — no invented ceilings (AR-4).
6. The 690–719 offer-window timing semantics are production behavior and are untouched; the sanitizer's domain clamp only affects hand-edited persisted values.
7. `activeActivity` anchors to the live active invitation (doc 14 §4.3 / LR1-15b); occupancy additionally requires the accepted invite + interior location + matching station; the SR-2b restore derives exactly what `enterNookAction` would have written.
8. The pure `stepSimulation` wrapper never aliases input resident records and never fabricates records the input lacked; `stepSimulationInPlace` (production) is untouched.
9. Journal bounds: `world.memories` ≤ 96 (newest-first; content ceiling ≈58), journal read-keys ≤ 240 symmetric on write and load.

## 5. D10 (LR-3) boundary

D10 (`offerPhases: ['morning']`) is **USER APPROVED** as an owner decision but **not implemented** — no LR-3 production code, schema change, invitation definition, or dialogue content exists anywhere in this integration (pre-publication gate §23 verifies this mechanically). The owner-decision record lives in `08-lr3-d10-owner-decision-record.md` with the exact follow-up action for the LR-3 decision register.
