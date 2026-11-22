# Social Foundation — Post-Integration Adversarial Audit
# 12 — Adversarial Test Results

Two complete rounds per brief §14: Round One (specialist challenge — every specialist challenged other specialists' candidate claims; all disagreements resolved by code and reproducible behavior) and Round Two (independent failure hunt — Specialist I, deliberately attempting to break the system with mutation tests, adversarial state construction, save corruption, replay, boundary and cross-system tests).

## 1. Round One — cross-specialist challenges (resolved with evidence)

| Challenge | Challenger → challenged | Resolution |
|---|---|---|
| "`slice(0,6)` returns the oldest memories (doc/behavior mismatch)" | Parent → SF-1 | **REFUTED**: `world.memories` is newest-first (20 prepend writers, 0 append writers — grep-proven); scratch repro confirms `playerMemories` = newest 6 exactly as documented |
| "Community pulse can collapse after memory eviction" | Parent → SF-3 | **REFUTED**: cap-96 trim is newest-first; count plateaus, never drops; counters never reset — pulse is monotonic |
| "`trust_heart_drift` probe fires during legitimate play" | Parent → SF-1 | **REFUTED** (that probe): every affinity writer coheres trust; a mixed stress world across all 10 residents yields zero incoherencies — **but the sibling `kindred_but_guarded` probe DOES fire (R-01 CONFIRMED)** |
| "`hasLeftKeepsake` 'ever' semantics broken by pruning" | Parent → SF-1 | **REFUTED**: single writer appends under dedup guard; never pruned; bounded by the 10-resident roster |
| "Bell gate leak is P1" | Parent → SF-3 | **CONFIRMED mechanism, downgraded to P2-latent**: no legitimate play path creates a second suppressed pair in shipped content (worst reachable: barnaby:toby 10/28 — never crosses suppression); live impact nil; future-content exposure real (doc 05 §2) |
| "Band-invariant claim is precise" | Parent → SF-4 | **CHALLENGED AND UPHELD-AS-FALSE-AS-STATED**: true only for band bases; one production-reachable inversion via the rumor path (R-05/R-06, doc 06 §1) |
| "Invitation claims say six canonical writers" | B ↔ framework header | **RESOLVED: six is correct** (`expireInvitationsInPlace` is the sixth); the framework header lists five — P3 doc gap |
| "Cancel corrupts story seeds via history outcomes" | G → C | **REFUTED**: `deriveSharedHistory` filters `outcome === 'completed'` only; cancelled rows count only toward `expiredCount`; `thank_you_owed` doesn't read history at all |
| "Journal can change after cancellation" | B → brief §6.3 | **REFUTED by code-path proof** (cancel writers touch only invitations/occupancy/activeActivity; persisted journal = `world.memories`); pin-gap noted |
| "Fallback `trust*20` diverges from the seed" | A → SF-1 | **REFUTED**: seed-exact for all 10 residents; divergence needs trust ∉ [0,5] (unreachable — all writers clamp) |

## 2. Round Two — mutation testing (Specialist I; disposable worktree, one mutation at a time, full suite after each; all mutations reverted, worktree removed)

**37 mutations applied → 22 detected / 15 survived.** The survived set is concentrated in **coverage gaps on claimed contracts** — every survivor's unmutated behavior was manually verified correct.

### Detected (22) — the suite holds these lines
Pair-key reversal; suppression-check removal; familiarity threshold shift; completed-visit double-count; incoherence reference-check removal; `isMemoryPlayerKnown` clause A and B breakage (lockstep detected); cancel awards affinity +5; cancel loses idempotency; offered-cancel rerouted through expiry writer; `unlockMet` flipped to AND; `playerKnowsTie` removed; memory-naming-both path removed; chapter fallback for unmet residents; both-sides tier → any-one-side; thank-you ignores `giftsGiven`; pulse threshold 8→1; open-visit ignores liveness; **engine ±5 clamp removed** (SF4-03b catches hostile inputs); engine topic sort flipped (15 tests fail); R1 echo fires on mentioned memories.

### Survived (15) — high-value pin gaps (all verified correct today)
1. `getEffectivePlayerAffinity` drops `Number.isFinite` guard (no test feeds NaN affinity; guard works)
2. `buildRelationshipProfile` familiarity fallback drops `met?10:0`
3. **`previousStatus: 'accepted'` always** — the "truthful previousStatus" QA fix (F6) is **not actually pinned by any test**
4. `MAX_SEEDS` cap removed (SF3-12 stages ≤ 6 seeds — its cap assertion is vacuous there)
5. Tie-break id desc (no equal-priority seeds in tests)
6. `isMemoryExpired` ignored in `playerKnowsTie` (no expired-pair-memory test)
7. Quiet-feeling drops `met` gate (saved by the affinity gate in the tested fresh world — redundant defense-in-depth)
8. `MAX_CONTEXT_BOOST` 5→50 (SF4-04 asserts the imported constant — tautological under mutation; SF4-04 also vacuous per doc 06)
9. `PROTECTED_CATEGORIES` check removed (SF4-03/03b inject boosts directly, bypassing the producer)
10. R2 reunion boost applied to all categories (+3 < 6-pt gap — no cross-band today)
11. `computeContextBoosts` drops met gate (redundant with engine gate)
12. `SHARED_ECHO_WINDOW_DAYS` 6→600 (redundant today: the only tag-matching topic self-gates 6 days)
13. `getNotableNpcBonds` sorts ascending (documented sort never asserted)
14. `getSuppressedNpcPairs` stops sorting keys — **removal would make seed order save/load-dependent** (sanitizer rebuilds `npcRelations` in its own insertion order) — a determinism claim unpinned
15. `deriveSharedHistory` counts declined as completed (no mixed-outcome test)

## 3. Adversarial state construction (raw corruption → SF layers, sanitizer bypassed)

9 crash classes found, **all confined to in-memory corruption paths** (the load sanitizer drops or repairs every class): null `npcMemories` element crashes 4 SF entry points via `isMemoryExpired` (chassis parity — `memories.ts` crashes identically; sanitizer drops non-records); unknown resident id crashes 4 public APIs (R-10); mirrored `npcRelations` keys yield duplicate suppressed pairs pre-sanitize (probe flags them); corrupt history `outcome` passes through the ledger's typed field pre-sanitize (cosmetic type lie; dropped silently on load); `meetsRelationshipUnlock(NaN, …)` returns true (NaN → 'kindred' tier fallthrough — unreachable via the guarded accessor); future-day worldEvents pass `companionsToday` pre-sanitize; a met resident with a wholly missing relation row is a probe blind spot (unreachable post-sanitize); bogus emotion strings degrade without crash. **No crash is reachable from a sanitized save.**

## 4. Save/load corruption (tampered JSON → deserialize → SF)

"abc" affinity → clamped default; NaN/Infinity literals → invalid JSON → fresh world + warning; truncation → fresh world + warning; doubled keys → last-wins + dedupe; corrupted active invitation → cleared with warning; bogus history rows → dropped (silently — the observability asymmetry); weird-reason rows kept; future `schemaVersion: 12` → conservative sanitize, payload never rewritten (v11 boundary intact); ancient `schemaVersion: 3` → full chain → v11 clean; round trip byte-identical. **The sanitizer fully guards every SF-read field before SF runs.**

## 5. Deterministic replay and cross-system interplays

Replay: identical before/after round trip; key-order perturbation insensitive (array-order semantics documented); 10-day forward replay ×2 byte-identical; `Math.random`/wall-clock ban grep-clean. Interplays: cancel × natural expiry both orderings clean (no double-archive); offer→accept→cancel→complete sequences fail-closed; cap-eviction vs tradition seed degrades gracefully (never dangles); boosts × history penalties — the echo cannot beat pending quest (100+45) or invitation (86+8) topics; echo re-selection blocked same-day (`notSeenToday` + mention flip verified written); maximal world (45 suppressed pairs) — seeds capped at exactly 6, journal build 2.9 ms, chapter lines truthful (repetitive by composition order — observation).

## 6. Regression hunt

Pre-SF baseline `e3f86b8`: 533/533. Shipped `07be49c`: 595/595. Zero pre-existing test files modified; exactly 4 deleted lines in the whole diff, all accounted (doc 02 §3); golden append-only and actively enforced. No regression found. Claims audit: 62 new tests ✓; "zero schema change" ✓; "LR-3 boundary mechanically verified" ✓ (re-verified); "tsc clean, build green" ✓ (tsc re-verified; vite build green in Phase 0); "browser QA passed" — independently re-executed with the same result (doc 07); "truthful previousStatus fixed" — behavior correct but **unpinned** (mutation 3).

## 7. Closure standard

Per the brief: no finding is closed merely because a test was added; a finding is closed only when the underlying behavior has been independently verified. Every detected mutation re-verified via targeted failure; every survivor manually adjudicated against unmutated behavior; every corruption class driven end-to-end through the sanitizer; every live-invariant claim (zero-reward, idempotency, fail-closed recovery, mention-flip correctness, seed self-heal) verified by direct construction, not by trusting the shipped tests.
