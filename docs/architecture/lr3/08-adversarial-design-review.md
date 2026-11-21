# LR-3 Adversarial Design Review

- **Date**: 2026-11-22
- **Status**: Phase Five deliverable (initiative §7). Independent cross-review of docs 04–07 against the actual `962fb07` source. Docs-only.
- **Method**: six complementary specialist reviews performed against the design documents **and** the source tree; adversarial cycle **Design → Independent Challenge → Evidence → Revision → Re-review** executed with two full rounds (recorded in §2). Disagreements are resolved by source evidence and explicit requirements, never by vote (initiative §7 rule).
- **Review inputs**: docs 01–03 (discovery record, preserved), docs 04–07 (this initiative's deliverables), source files cited therein, the reliability branch's deferred-findings register, and the LR-1/LR-2 as-built test batteries.

---

## 1. Review panel and verdicts (after revision round 2)

| Reviewer | Focus | Verdict after revision | Findings raised |
|---|---|---|---|
| Architecture reviewer | Reuse vs framework; ownership; import graph | **APPROVED** (after one REJECT round) | F-ARC-1 (rejected design), F-ARC-2 |
| Gameplay designer | Experience quality; Clara's voice; pacing | **APPROVED** (with one USER flag upheld) | F-GP-1, F-GP-2 |
| Simulation engineer | Determinism, tick purity, state ownership | **APPROVED** | F-SIM-1, F-SIM-2 |
| Persistence reviewer | v11 contracts, sanitizer, migration posture | **APPROVED** (gate-conditional item pinned) | F-PER-1, F-PER-2 |
| Test engineer | Battery strength, snapshot contract, coverage gaps | **APPROVED** | F-TST-1, F-TST-2 |
| Adversarial QA reviewer | Invalid states, contradiction hunting, lie detection | **APPROVED** (two pins added) | F-QA-1, F-QA-2, F-QA-3 |

Every finding below is recorded with its evidence and disposition; none is silently dropped.

## 2. The adversarial cycle — what actually changed

### Round 1 challenges and the REJECT

**F-ARC-1 (Architecture reviewer — REJECT, resolved).** The draft architecture adopted the proposed `reconcileInvitedInteriorEntry` helper in **all five** interior enter reducers, citing F-ENTER-1's "shared enter path" wording.
- **Challenge**: adopting in cottage/greenhouse/copperwheel changes observable behavior — those reducers never reconciled before, so a stale invitation would start producing expiry toasts on entering rooms it was never scoped to; five-reducer churn for zero contract value; and the doc 14/LRTL-05 ownership record ("host drift is owned by the enter reducer of the invite's location") does not require it.
- **Evidence**: `enterCottageAction` (`actions.ts:2112`) / `enterGreenhouseAction` (:2157) / `enterCopperwheelAction` (:3287) contain no reconciliation; LRTL-05's pin wording; the deferred finding's own revisit condition ("a second interior **gains an invitation-gated activity**") names the two-venue event.
- **Revision**: adoption narrowed to the two invite-gated venues (nook + bakery); cottage/greenhouse/copperwheel explicitly untouched with the rationale recorded (doc 05 §5.2, §9.4).
- **Re-review**: APPROVED — "the helper is the shared enter path for the interiors that participate in the invitation contract; the other three are not invite-gated and must not start reconciling."

**F-GP-1 (Gameplay designer — challenge, partially upheld).** The draft presented morning-only offers (D10) as a pure engineering correction.
- **Challenge**: it *narrows* availability vs the discovery baseline (doc 15:90 requires only afternoon suppression); is that over-restriction of a cozy, forgiving game?
- **Evidence**: golden (5.533 m) and dusk (0.0 m) offers genuinely pass today's gate (computed from `residents.ts:58-87` + `invitations.ts:59-79`); a "morning pastry" windowed to 1260 breaks the activity's identity (id, morningLark 0.9, bake roster, morning porch slot); the 719 cap already confines *completion* to morning — golden/dusk offers would be offerable-but-odd, and the dead zone at LR3-18 would widen.
- **Revision**: morning-only retained but reclassified as a **USER-flagged gameplay decision** (D10) with its mitigation stated (719 cap coherence + morningLark pacing) rather than silently engineering it. The register now asks the owner.
- **Re-review**: APPROVED with the flag upheld — "the restriction is right; who approves it is the point."

**F-SIM-1 (Simulation engineer — challenge, resolved).** The draft placed the helper in a **new module** importing invitations + activities + occupancy.
- **Challenge**: verify the import graph cannot close a cycle, and that the tick path stays allocation-free.
- **Evidence**: `activities.ts` imports `occupancy.ts` (constants) and `invitations.ts` imports `activities.ts` (`getSharedActivityDef`); placing the helper in `invitations.ts` (which may import `occupancy.ts` — no back edge) keeps the graph acyclic; importing invitations from occupancy would close `occupancy → invitations → activities → occupancy`. Helper is pure, allocation-light, and the tick's `expireInvitationsInPlace` path is untouched.
- **Revision**: helper placed in `invitations.ts`; the import-discipline note (do **not** import invitations from occupancy) made normative (doc 05 §2).
- **Re-review**: APPROVED.

**F-PER-1 (Persistence reviewer — challenge, resolved).** Registry-only persistence (D7) leaves `stationId` unvalidated against the registry on unhardened main (`migrations.ts:1555-1556` checks only non-emptiness); a hand-merged or future-stale save could restore a foreign stationId.
- **Evidence**: SR-7's clear+warn rule exists only on the unmerged branch (verified: `git diff 545e323..b71bb3c -- src/game/actions.ts` empty; branch surface is migrations/storage/journal/storylines/simulation(+tests)).
- **Revision**: doc 05 §12 + doc 06 LR3-34 made **gate-conditional** with the expected outcome pinned per chosen path; doc 07 D7 records it. Under path (b) the LR-3 branch re-derives SR-7's rule attributed as such.
- **Re-review**: APPROVED — "the design no longer silently inherits a branch-only contract."

**F-TST-1 (Test engineer — challenge, resolved).** Golden-snapshot regeneration (85 → 89) is the classic drift hole.
- **Evidence**: `dialogueRegistry.test.ts:44-93` pins count + order; HANDOVER §17 convention requires regeneration from the live registry with written behavioral justification.
- **Revision**: LR3-56 pins the procedure + the justification artifact; the count delta is stated exactly (4 Clara topics).
- **Re-review**: APPROVED.

**F-QA-1 (Adversarial QA — challenge, resolved).** Two completion surfaces (dialogue choice + station card) could diverge in writes.
- **Evidence**: doc 14 §5.1 requires both to call the single transaction; App.tsx handler vs `actions.ts:213-232` are separate code paths today.
- **Revision**: LR3-36 added (deep-compare both surfaces' world deltas).
- **Re-review**: APPROVED.

### Round 2 — residual challenges, all closed

**F-ARC-2**: "Is `summaryCompose` a framework seed?" — No: one function field on an existing def, default preserves current composition; the write set of the transaction is untouched (doc 14 §5.1 steps 1–11 remain the contract). CLOSED.

**F-GP-2**: "Is the activity too shallow to be meaningful?" — The meaning is carried by context (day-varying bake roster, Clara's wistfulness answered, one flavor choice) rather than mechanics; LR-2's depth lives in the same shape. Depth-by-mechanics was explicitly rejected in doc 04 §3.3 (minigame, two-station, dual-memory variants). CLOSED as a design stance, recorded for the owner to revisit after playtesting.

**F-SIM-2**: "Does the occupant skip interact with Clara's exterior extras?" — While occupant, Clara is fully tick-skipped (`simulation.ts:653-656`), so her weighted extras (greenhouse/orchard) cannot move her; on session end she re-enters the normal selection. Verified against the existing nook behavior. CLOSED.

**F-PER-2**: "Does the def's `offerPhases`/`arrivalLine`/`summaryCompose` force a WorldState change?" — No: def fields are code-shape, not save-shape; v11 untouched; D7 holds. CLOSED.

**F-TST-2**: "Is `minutesSpent` dead?" — Verified: declared + initialized (`activities.ts:42,64`), never consumed outside the def. Kept for interface parity, flagged in doc 05 §6.1; a cleanup may ride the LR-3 branch only if reviewers accept the trivial diff. CLOSED (tracked, not hidden).

**F-QA-2**: "The 690–719 dead zone contradicts 'grounded windows'." — It is the *as-built* cap shape Nora already lives with (same function, same constant); changing it would alter pinned windows; the enter path fails visibly and LR3-18 pins it. Recorded as accepted as-built semantics, not a silent gap. CLOSED.

**F-QA-3**: "Could the arrival toast lie if Clara is encounter-staged after occupancy?" — No: enter checks availability *before* placing; completion re-checks encounters (D-04/H-1, `activities.ts:209`); mid-session drift cannot complete silently (LR3-39). CLOSED.

## 3. Challenge-question matrix (initiative §7, answered with evidence)

| Question | Answer | Anchor |
|---|---|---|
| Is LR-3 genuinely content-scale? | Yes at the simulation layer — def + quartet + guards + anchor — **plus** the two forced corrections (enter helper; text derivation) and the scene parameterization; 10 verified seams (doc 02 §5) with 3 amendments (doc 04 §10) | doc 04 §4, doc 05 §4 |
| Does the second venue reveal an architectural defect? | Two: F-ENTER-1's asymmetry (fires exactly now; resolved by the helper) and the completion-text hardcoding (F1; resolved def-level). Both are narrow, evidenced, and framework-free | doc 05 §9, §6.2 |
| Is F-ENTER-1 being handled correctly? | Yes — shared helper adopted by the two invite-gated venues; duplication avoided; branch direction honored without copying (branch implemented none); gate-conditional interplay documented | doc 05 §9.3–9.4, doc 08 §2 |
| Are station reservations owned coherently? | Yes — set by enter helper, cleared by complete/expire/exit/day-advance/sanitizer (the five LR-2 owners); no new cleanup path; guards matrix explicit | doc 05 §6.4, §3 |
| Is the schedule design realistic? | Yes for morning (1.02 m slot, 719 cap); the golden/dusk reality is *fixed by decision D10* rather than ignored; dead zone documented and tested; availability-vs-position divergence voiced, not re-architected | doc 04 §1.2–1.3, doc 05 §7 |
| Is the activity too mechanically elaborate? | No — one conversation beat, one flavor choice, existing transaction; minigame/two-station/dual-memory rejected with reasons | doc 04 §3.3 |
| Is the activity too shallow to be meaningful? | Meaning is contextual and characterful by design stance; owner may revisit post-playtest (F-GP-2) | doc 08 §2 |
| Are Clara's behaviors consistent with her characterization? | Every beat maps to source-verified traits/arcs; no invented backstory; solo rituals untouched | doc 04 §1, §3.2 |
| Does the player understand what to do? | Offer dialogue + registry-generic journal card + venue-true toasts + refusal lines; zero new UI | doc 04 §3.4, LR3-45 |
| Are dialogue and journal outcomes consistent? | Quartet conditions map 1:1 to state; golden regen pinned with justification; journal text pinned venue-true | LR3-49–56, LR3-45 |
| Are all state transitions recoverable? | Enter/exit idempotent; expiry single-archive; sanitizer clears malformed states; no unit-clear reintroduced | §3 lifecycle, LR3-71–86 |
| Is persistence sufficient without a schema change? | Yes — verified field-by-field; binding stop-rule if new state emerges | doc 05 §6/§12, D7 |
| Are the tests strong enough to catch regressions? | 86 scenarios covering full lifecycle, cross-venue interleaving, tick/load parity, adversarial matrix; every inherited battery re-run | doc 06 |
| Is the proposed architecture unnecessarily generalized? | No — approach B won the 8-criterion comparison; C/D rejected with re-open conditions | doc 05 §10, D5 |
| Can another venue be added without copying? | Yes — next venue = def + lines + seat + helper call + guards + quartet + rig registration, each isolated | doc 05 §10 acceptance condition |
| Can a future developer understand it without project history? | Read path `invitations.ts → actions.ts(enter) → activities.ts(complete)`; ownership stated in §3; decisions recorded in doc 07 | doc 05 §10 |

## 4. Disagreements and their resolution

1. **Helper adoption breadth** (architecture vs simulation engineer): resolved by behavior-preservation evidence — two venues (F-ARC-1). The simulation engineer's import-graph concern was satisfied by placement (F-SIM-1). No vote taken; evidence decided.
2. **Morning-only** (gameplay vs simulation/test): the simulation/test side noted it simplifies dead-zone exposure; the gameplay side insisted it is experience-narrowing. Resolution: keep the design, move the approval to the owner (D10) — the correct owner per the initiative's decision discipline.
3. **`summaryCompose` shape** (persistence vs architecture): function-field vs template-string was debated; function-field won because the bakery summary needs the day's bake roster (a computation, not a substitution). Evidence: `getBakeForDay` is day-deterministic (`bakery.ts:163-167`), so determinism holds either way; the function field avoids a template mini-language.

## 5. Panel consensus statement

All six reviewers approve the revised design (docs 04–07 as amended by this review) as **implementation-ready design work**, with two explicitly USER-gated items before feature code (D10 offer-phase; reliability-gate path a/b/c) and one gate-conditional test expectation (LR3-34). No reviewer approved merging anything, starting implementation, or modifying PR #3 / PR #7 / the reliability branch.
