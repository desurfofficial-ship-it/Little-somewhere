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

---

## 6. Reconciliation-era adversarial review (2026-11-22, post-integration)

**Trigger**: the Systemic Reliability integration (PR #11, merge `f1c2af4`) and visual-identity BUILD 03/04 landed on main after this review was written; the owner then commissioned the LR-3 reconciliation initiative to re-verify the entire design record against current main (`a80a220`) and repair what the merges made stale. The original §1–§5 review record above is preserved verbatim; this section records the reconciliation's own adversarial cycle.

**Method** (same discipline as §2 — evidence over consensus): three independent specialist auditors inspected primary source in parallel against `a80a220` — gameplay/narrative (doc 04), architecture/systems (doc 05 + the merged reliability contracts), QA/acceptance (doc 06 + doc 03 §3) — each producing a findings register; the lead independently re-verified every material correction first-hand (sanitizer semantics read directly from `migrations.ts`, baseline suite re-run, PR states pulled from the GitHub API); findings were repaired in docs 01–09; a second adversarial cycle (independent adversarial reviewer + documentation/integration reviewer) then attempted to disprove the repaired record, followed by an independent final release audit against the master initiative's 22 release gates. Worklogs: `reconcile-scratch/agentB-gameplay-audit.md`, `agentC-architecture-audit.md`, `agentD-acceptance-audit.md` (session artifacts, summarized here).

### 6.1 Findings, severity, evidence, repair, disposition

| ID | Finding | Severity | Evidence (a80a220, first-hand) | Repair | Disposition |
|---|---|---|---|---|---|
| F-REC-1 | Doc 06 LR3-79's expected outcome contradicted shipped main: the sanitizer **clamps** out-of-domain window minutes with a warning; only non-finite or `start > end`-after-clamp drops the record. The original "cleared as corrupted (:1433)" expectation would **fail as written** against integrated main | BLOCKING | `migrations.ts:1569-1593` (clamp + warning string), `:1604` (`windowStartMinute <= windowEndMinute` conjunction), `:1625-1626` (drop path) — read directly from source during reconciliation | LR3-79 rewritten to the exact SR-6 semantics (clamp+warn; drop only on non-finite / post-clamp inversion); doc 05 §12 re-based | CLOSED (doc 06 §8) |
| F-REC-2 | Doc 06 LR3-34 and doc 05 §12 were framed **gate-conditional** on SR-7 ("main silently keeps non-empty stationId strings") — obsolete: PR #11 shipped SR-7 unconditionally and pinned it | BLOCKING | `migrations.ts:1772-1773` (`occ.stationId === SHARED_ACTIVITIES[active.activityId].stationId` else `"inconsistent interior occupancy cleared on load"`); `save-integrity.test.ts` SR-7 fixture (37-case suite now on main) | LR3-34 rewritten as an unconditional SR-7 regression pin; LR3-81 pointer resolved; doc 05 §12 updated; doc 02 §6.1(3) records the shipment | CLOSED |
| F-REC-3 | Doc 06 DoD item 2's arithmetic ("447 + reliability's 459 when merged") is stale post-merge — the reliability suite is inside the merged baseline | BLOCKING (documentation-truth) | `npm test` on `a80a220`: **528/528 across 63 files** (first-hand re-run; matches HANDOVER §19's record) | DoD item 2 corrected to the 528/528 baseline; doc 06 header states the battery total (98 scenarios) | CLOSED |
| F-REC-4 | ~12 stale line citations in the five reliability-touched files + `NeighborhoodCanvas.tsx`/`App.tsx` (BUILD 03/04) across docs 02/04/05/06 | MINOR | Re-base table verified symbol-by-symbol: `migrations.ts` sanitizer `:1532-1844` (v10→v11 `:2401-2410`), `storage.ts` dawn `:555-648` / reconcile `:670`, `simulation.ts` clone `:1106-1117` + residents `:1059-1072`, `journal.ts` card `:1183-1200`, `App.tsx` `:961-975`, Canvas rig `:945-961` / routing `:1477-1502` / sync `:2086-2137` | All re-based inline with `[Reconciled a80a220]` markers; unchanged files verified byte-identical (`git diff 962fb07 a80a220`) | CLOSED |
| F-REC-5 | Doc 04 §1.4 cited two wrong storyline facts: `conflict_plaza_lanterns` (has no Clara; `storylines.ts:41` is `side_pip_zine`'s participant pair) and "main Silent Gazebo Bell storyline (`storylines.ts:26`)" (that line is `side_pip_zine`'s lead list) | MINOR | `storylines.ts:26/:41/:199`; the bell narrative lives in `actions.ts:1707`/`journal.ts:1212`/`bellQuest.ts`; Clara's bell-arc hook is `quest_clara_rift` (`bellQuest.ts:278-282`) | §1.4 corrected with the provenance note; §10.4 records the amendment | CLOSED |
| F-REC-6 | Doc 04 §1.3 omitted two verified Clara weighted extras: `clara_rain_oven` (w 1.6, rain-gated porch) and `clara_cafe_tables` (w 1.3, afternoon+golden, flag-gated, ≈ 2.059 m) | MINOR | `residents.ts:680-751` extras table | §1.3 amended (both refine the divergence picture; conclusions unchanged); §10.4 records | CLOSED |
| F-REC-7 | A fourth venue-coupled completion string exists beyond F1's three: the host-unavailable **refusal toast** `activities.ts:214` ("the shared **reading** can't finish right now") | MINOR | `activities.ts:209-216` read directly | Folded into D9's def-level composition scope; doc 04 §4.2 updated; new pin LR3-88 | CLOSED |
| F-REC-8 | The sanitizer's history-row repair defaults a missing `activityId` to `'share_featured_reading'` (`migrations.ts:1649-1652`) — after LR-3 adds Clara rows, a hand-edited row could be silently mislabeled as a reading | MINOR (implementation-time) | Read directly from source; unreachable from production writers (every writer sets the id) | Recorded in doc 05 §12 + doc 09 §4 as an implementation-time follow-up (generalize the default def-driven or drop-and-warn); NOT a design change; LR-3 documentation makes no claim it is fixed | OPEN — owned by the implementation initiative (non-blocking) |
| F-REC-9 | BUILD 04 added an `emotionIntensity` reset (`NeighborhoodCanvas.tsx:2115-2118`) inside the occupant sync region doc 05 §8 parameterizes | INFO | Read directly from source | Doc 05 §8/§4/§9.5 note: the D8 sync generalization must carry it | CLOSED |
| F-REC-10 | Golden-snapshot stability re-confirmed post-merges: registry unchanged (85 topics; Clara 10; BUILD 03/04's `dialogue/assets.ts` change is visual-only) | INFO | `dialogue-topics-golden.json` count; golden test intact | doc 04 §10.6 records; 85→89 remains solely LR-3's obligation (LR3-56/98) | CLOSED |
| F-REC-11 | Journal memory cap enforcement (96-row newest-first trim) is now a main contract (was "branch-only") | INFO | `save-integrity.test.ts` SR-1; sanitizer trim | doc 02 §7 risk row updated; LR-3 headroom obligation unchanged | CLOSED |
| F-REC-12 | Acceptance-battery field-shape inconsistency (§5–§8 lack some of §1–§4's columns) | MINOR | Doc 06 structure review | Disposition: the shapes follow doc 16's own conventions (compact dialogue/adversarial matrices); each section now declares its column contract explicitly; all **new** scenarios (LR3-87–98) use the full nine-column contract | CLOSED (convention recorded) |
| F-REC-13 | Coverage gaps vs the initiative's mandatory category list: no bakery enter-with-expired-invite case; no save-before-invitation case; no tier-progression case; no quartet-cooldown pin; no repeated-sanitization idempotence pin; accept-toast venue truthfulness unpinned; accept-availability boundary unpinned; §8 rows lacked existing-coverage references | MINOR | Agent-D audit vs the initiative's §6.1 category list | Closed by LR3-91/92/93/94/95/96/87/98 + §8's coverage note; §8/§9 mapping updated | CLOSED |

### 6.2 Cycle-2 adversarial verdict and final audit

Cycle 2 (post-repair) challenged the repaired record on three fronts — (a) no silent scope expansion (every edit is evidence-anchored; no new decision was invented; D10's approval is quoted from main's record, not paraphrased), (b) no history damage (PR #7/#8 branches untouched — verified by head-SHA equality before/after), (c) no false readiness claim (doc 09's verdict is upgraded strictly because both USER gates resolved with primary-source evidence). Cycle 2's own findings (provenance precision on D10's §4 trigger, missing annotations in the ported records, citation hygiene) were repaired in the same reconciliation; the final release audit then verified the master initiative's 22 mandatory gates against the actual branch diff — all gates passed — and results are recorded in the initiative's final engineering report (sections A–L, delivered with the reconciliation PR description) and in WORKLOG Entry 059.

**Reconciliation panel verdict**: the reconciled docs 01–09 are implementation-ready design work on the integrated tree; the three BLOCKING documentation defects (F-REC-1/2/3) are repaired; one non-blocking follow-up (F-REC-8) is honestly deferred to the implementation initiative; the merge-readiness verdict for the documentation PR itself is recorded separately (doc 09 §2 note + final report §K) — approving the design is distinct from authorizing the merge, and neither constitutes LR-3 implementation authorization.
