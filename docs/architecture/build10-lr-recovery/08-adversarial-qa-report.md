# 08 — Adversarial QA Report

Structure: five independent specialists (parallel sub-agents, read-only remits) + lead-run mutation checks. Every specialist stated what they tried to break and disclosed untested areas; their raw reports are preserved in the operation log. Disagreements were resolved by code evidence, not vote.

## §1 Independent Architecture Auditor — PASS

- Restored step-0 block: **byte-identical** to 9cde87d (md5 equal), lifecycle position identical.
- Ownership discipline holds: pure reducers vs in-place tick; strict predicate changes *when* expiry fires, not *who* mutates; all call sites consume results correctly.
- Persistence: the only "tick accepts what save destroys" pair left is **hand-staged-only** (sanitizer cross-checks hostId/activityId membership; unreachable via `canOfferInvitation` gates). "Tick destroys, load restores": not constructible (tick clamps the clock before reconciling; load clamps identically).
- Registry: 85/85/85 (runtime = golden = runtime snapshot), order-identical, zero duplicate ids, no scoring interference.
- Decision consistency: strict unification consistent with doc 14 §2.4 + doc 21 §2.4; **no documented production behavior relied on the tolerant reading**. Actionable finding: doc 20/21 + this package must land on the branch for citation traceability (done — see doc 11).
- Pre-existing hazards exposed, labeled, deferred: P-2 asymmetric enter reducers (only the Nook reconciles on entry), P-3 ~30 minute-mutation reducers rely on the tick backstop, P-4 `worldRef.current === worldSnapshot` aliasing, P-5 save-time sanitizer archives silent.

## §2 Build-10 Recovery Auditor — restoration holds; one visual-layer finding

- D-01 runtime path verified from the browser entry: `NeighborhoodCanvas` rAF → `stepSimulationInPlace(worldRef.current, dt, { paused: state==='paused', dialogueOpen: … })` — walking ⇒ unpaused ⇒ step-0 executes every frame; load path preserves `explored_*` + memory rows.
- **Visual-layer finding (pre-existing, faithful to 9cde87d):** discovery granted by the in-place tick reaches the Pocket Journal only after the next world-committing action (JournalDrawer memo keyed on `world` identity; the tick mutates in place; `handleHudSync` does not commit), and there is no toast (the block discards the return — 9cde87d behavior). Data layer is fully correct (probe: fresh `buildPocketJournalView` reflects the grant; autosave hashing flips). Disposition: **deferred** as F-UX-1 (doc 12) — it predates the regression and the restoration is mandated byte-identical; browser QA documents the actual player experience (doc 09 G1).
- D-02: no suppression path; measured competitor table (doc 04 §3); byte-compare of `dialogue/index.ts` vs 9cde87d shows only the intentional LR additions; `interiors/wilds.ts` conditions match 9cde87d verbatim.
- Break attempts: duplicate discovery over 500 ticks (blocked), indoor false discovery from all 7 exterior anchors (blocked — all anchors >10 m from zones; caveat: entering an interior from inside a zone fires a *delayed* grant using the true occupied coordinate — never fabricated), day rollover (blocked), golden sequence (blocked), topic steal from invitation topics (blocked — 48 < 92 floor).
- `qa_wilds.sh` compatibility: every assertion satisfiable by the restored code (doc 06 §4).

## §3 LR Adversarial Tester — lifecycle holds; H-1 confirmed and repaired

- 9 probes / 205 checks: offer/accept edges (incl. DAY_START/END clamps, inclusive bounds, failed accepts never mutate), strict-predicate attacks (pre-window archive exactly once, inclusive `windowEnd` live, malformed actives cleared safely), host-drift ownership, occupancy round trips (identical station/localPos/facing/invitationId), malformed saves (caps FIFO, garbage rows dropped, corrupt JSON → fresh world), time advancement (one-jump archive exactly once; day-end archive), determinism (500-tick offer/accept/enter/expire script **byte-identical** across runs; no wall-clock/RNG in core modules).
- **H-1 confirmed** (LOW-MED, corrupted-save reachability): completion with an absent host granted full rewards. **Repaired** in commit `6812bba` (doc 05 §4); re-verified by the new pins.
- Sanitizer hardening gaps (LOW, hand-edited saves only): no range validation on invitation minute fields (`windowStart:-50, windowEnd:1400` survives) or `expiresDay` upper bound; occupancy `facing`/`localPos` finite-checked only. Deferred as F-SAVE-1/F-SAVE-2 (doc 12).
- Negative-delta clock jumps can archive a live invite at the earlier minute (time reversal; unreachable via UI's +2h). Noted, no action.

## §4 Save / Migration / Determinism Specialist — PASS (H-2 confirmed, deferred)

- Migration chain v7→v11: no field drops (18/18 input keys preserved, mixed-type sideFlags, dup/junk memory handling); v9 spot-check clean; deterministic output.
- Round-trip fixed point (s2===s1, s3===s2) at 11 boundary minutes + a 30 000-tick soaked 36 KB world.
- Long-run: 2×12 000-tick runs byte-identical at every checkpoint; growth bounded (worldEvents 40, activityHistory 8×10, npcMemories 14×10 caps; JSON plateaus ~36 KB); discovery idempotent over 20 000 ticks; invitation cap 12 enforced on tick and sanitize paths.
- Wall-clock leakage: zero `Date.now`/`performance.now`/`new Date` in src/game; `Math.random` only in audio.ts (outside the tick graph); localStorage only in storage/journal read-markers, never in the tick call graph.
- Save revision hashes every slice the restoration touches (discovery grant flips the autosave stamp end-to-end).
- **H-2 confirmed, deferred:** pure `stepSimulation` fails to clone `residents` — `updateResidentEmotionInPlace` writes `.mood` in place (leak measured: 4 mood paths; first natural leak at pure step 682). Zero non-test production callers; discovery amplification refuted (copy-on-write). Recommended follow-up: shallow per-resident record clone. Deferred as F-SIM-1 (doc 12) — test-only reachability, out of the mandated minimal scope.

## §5 Performance & Stability Reviewer — no frame-budget risk (doc 10 for numbers)

Within-instance marginal benchmarks (methodology note: cross-tree A/B has ±1.6–3.5 µs phantom deltas on identical code — mandated within-instance method for future claims): restored block 78–165 ns/tick (≈0.001% of a 16.7 ms frame); dialogue +68–171 ns per open; memory flat over 20 000 ticks; counters bounded; dist +5.3 KB (+0.30%).

## §6 Lead-run mutation checks (every check applied → measured → reverted; clean state re-verified after the cycle)

| Mutation | Expected | Measured |
|---|---|---|
| M1: remove step-0 discovery call | D-01 tests fail | **7/13 fail** (BD10-01…04, 06…08) |
| M2: drop WILDS_TOPICS from registry | D-02 tests fail | **10/13 fail** |
| M3: restore tolerant predicate | LRTL-01 fails | **LRTL-01 fails** (7/8 pass) |
| M4: drop INVITATION_TOPICS (naive revert) | anti-over-revert half fails | **11/21 fail** |

Post-cycle clean state: **425/425, tsc 0, build 0**. (Process lesson recorded: `git checkout --` on a dirty tree restores HEAD — two fixes had to be re-applied after early mutation reverts; all re-applications verified by targeted + full suite runs.)
