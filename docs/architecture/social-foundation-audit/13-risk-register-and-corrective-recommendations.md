# Social Foundation — Post-Integration Adversarial Audit
# 13 — Risk Register and Corrective Recommendations

Risk classes: **P0** critical (data corruption, unrecoverable saves, severe determinism failure, simulation integrity failure) · **P1** high (core gameplay regression, hidden-information leakage, broken lifecycle invariant, significant architectural incompatibility — *technical*; process incidents are classified separately) · **P2** medium (incorrect edge behavior, maintainability problem, incomplete contract, notable performance risk) · **P3** low (documentation inconsistency, minor UX, non-blocking polish).

**P0 count: 0. P1 technical count: 0. P1 process count: 1 (R-07). P2 count: 6 technical.** Every entry: evidence-backed, reproduced, with a recommended correction for a future authorized task. **No correction was applied during this audit.**

## R-01 (P2 · SF-1) — `kindred_but_guarded` probe false-positives in legitimate play
- **Evidence:** socialProfile.ts:472-474/507-513; relationships.ts:85-98; simulation.ts:378-379; canonical-writer scratch repro fires the probe (two independent paths). Likelihood: high in long saves (shipped dialogue sets frustrated/embarrassed; hunger-decay sets frustrated; `negativeCount` is lifetime and never decremented).
- **Impact:** QA-gate noise — any future SF1-13-style "coherent world reports zero incoherencies" assertion false-fails; the probe's own doc contract ("corruption-only") is false.
- **Blocks LR-3:** No (but fix before LR-3 QA writes zero-incoherency gates).
- **Recommended correction:** restrict the probe to persistent-state guardedness (reliability/negativeCount channels), or correct the doc + SF1-16 title to describe the transient-emotion reachability.

## R-02 (P2 · SF-2) — cancellation of a corrupted-status active fabricates a `player_cancelled` row
- **Evidence:** invitationFramework.ts:128-154; scratch repro with `active.status = 'declined'` → archives `{outcome:'expired', reason:'player_cancelled'}`, ledger "Stepped back". In-memory only: the save sanitizer drops corrupted-status actives pre-JSON with no history row, and no production writer can produce a bad status today. Likelihood: low.
- **Impact:** ledger honesty on a corruption path; the only code path that converts a corrupted active into a history row.
- **Blocks LR-3:** No.
- **Recommended correction:** fail closed (`no_active_invitation`-class refusal) for statuses ∉ {offered, accepted}; pin with a corrupted-status test (also closes mutation-survivor #3, which proves `previousStatus` truthfulness is unpinned).

## R-03 (P2, latent · SF-3) — `playerKnowsTie` bell gate is pair-blind
- **Evidence:** emergentStories.ts:92 (`if (world.flags.heardBellMystery) return true;` for any pair); scratch repro fires `seed_rift_bridging_pip_sora` with zero pair evidence; hand-edited suppressed pairs persist through save/load (sanitizer admits tension ≥ 45 pairs); doc 22:55 codifies the gate without the cross-pair caveat; module header contradicts it.
- **Impact today:** nil — the only suppression-capable writer in shipped content cannot reach suppression, and the sole baseline suppressed pair is exactly the pair the bell flag evidences. **Exposure: medium-high across LR-4/LR-5 social content.**
- **Blocks LR-3:** No. **Fix before any future content writes negative npc-relations.**
- **Recommended correction:** scope the flag to `arthur:clara` (pair-keyed evidence), plus a cross-pair regression test (flag true + foreign suppressed pair + no pair memory → silent).

## R-04 (P2 · SF-3/Journal) — quiet-feeling copy contradicts its own trigger
- **Evidence:** emergentStories.ts:218-221 (seed), :354-366 (chapter); trigger `feeling ∈ {sad,frustrated} ∨ mood === 'wistful'` vs label `getEmotionLabel(feeling ?? 'sad')`; repro: wistful mood + runtime `excited`/`relaxed` → "has seemed **eager/peaceful** lately; a gentle check-in might land well". Reachable in live play (fresh Clara/Arthur spawn wistful; mood locked 180 min while sim refreshes emotion; gate is acquaintance-only). Likelihood: moderate.
- **Impact:** narrative correctness on the most player-visible new surface (People cards).
- **Blocks LR-3:** No.
- **Recommended correction:** label from the low signal (`moodToEmotion('wistful')` when mood fired the trigger), or require the resolved feeling itself to be low; one-line derive fix + test.

## R-05 (P2 · SF-4) — shared-visit echo asserts firsthand participation to rumor holders
- **Evidence:** reflections.ts:48-56 (no `provenance` branch); dialogueContext.ts:123-134 (R1 ignores provenance); gossip propagation copies `shared_featured_reading` memories preserving tag (memories.ts:888-919); end-to-end repro: mina (never attended) says *"the little while **we spent together**…"*. Legacy celebration/gift topics branch on provenance. Likelihood: medium (routine gossip, 6-day window).
- **Impact:** immersion/truthfulness (not a hidden-info leak — the player knows the visit happened).
- **Blocks LR-3:** No; **exposure multiplies when LR-3 adds the second `shared_*` tag.**
- **Recommended correction:** filter `provenance === 'firsthand'` in `collectUnmentionedSharedTags` + add the condition field (or add the legacy provenance branch to the text). Also closes the R-06 inversion's only known path.

## R-06 (P2 · SF-4) — band-invariant claim false as stated; one reachable cross-band inversion
- **Evidence:** dialogueContext.ts:44-48/65-68 + dialogueEngine.ts:855-859 + doc 22 §4.1 + SF-D5 claim "can never smuggle a topic across bands"; arithmetic: echo 68+14+5 = 87 > `side_rowan_orchard_1` 76+8 = 84; production repro via R-05's rumor path (rowan). All other higher-band pairs safe today (invitation min 92, conflict min 90, personal ≥ 89 otherwise, quest ≥ 140). Pre-SF authored totals already crossed band bases (event_gift_thanks = 86 = invitation base) — the claim was true only for band bases.
- **Impact:** realistic dialogue-order regression (an everyday echo can displace a personal-story beat); margin 3 points; likelihood low-medium.
- **Blocks LR-3:** No.
- **Recommended correction:** R-05's firsthand filter (preferred — fixes both), or an authored-priority budget for `shared_*`-tagged non-protected topics; **correct the doc claim** in dialogueContext/dialogueEngine/doc 22; extend the LR-3 per-topic justification template with `CATEGORY_PRIORITY + priority + 5` vs the next protected band's minimum live score; add adjacent-band inversion pins (SF4-03 tests only the 66-point gap).

## R-07 (P1 · PROCESS · Governance) — direct-to-main publication bypassing the declared release protocol
- **Evidence:** doc 11 (full chain): no PR for `8b715fc`/`07be49c`; the repo's PR-merge protocol merged 2.5 h earlier via PR #14 was bypassed; CI reactive-only; Pages deploys untested to the public site; unsigned commits from an unlinked identity; branch protection UNKNOWN (403); recorded gate numbers describe a tree that was never shipped.
- **Impact:** process failure only — the shipped code is independently verified sound (docs 02-08, 12). Does **not** retro-authorize the push.
- **Blocks LR-3:** No.
- **Recommended correction:** the five minimum controls in doc 11 §5 (branch protection with PR-only merges being the decisive one); credential scoping; signing; gated Pages; comment/settings alignment. Owner action required.

## R-08 (P3 · documentation) — systematic stale claims
"590/590 (528 inherited)" vs actual 595/595 (533); "base a80a220" vs parent `e3f86b8`; doc 00/22 "588/588"; SF3/SF4 range mislabels (17/12 incl. -02b/-03b); doc 22 "Entry 057" → 058; HANDOVER §19 "f1c2af4" stale; "five call sites" file list wrong; WORKLOG "ten scenario classes" vs eleven; doc 04 gates describe the pre-rebase tree; doc 23 stale base. **Correction:** one documentation-reconciliation pass (doc 10 §6 items included). No behavior masked.

## R-09 (P3 · test-pin gaps) — 15 surviving mutations (doc 12 §2)
Cheapest high-value pins: >6-seed world for cap + tie-break; corrupt-status cancel probe (with R-02); sorted-pairs-order assertion (determinism-bearing); producer-level protected-category assertion; expired-pair-memory gate; mixed declined/completed history; NaN-affinity accessor guard; `previousStatus` truthfulness; `SHARED_ECHO_WINDOW_DAYS`; SF4-04 made non-vacuous. Recommended pre-LR-3.

## R-10 (P3 · hardening) — robustness consistency
Throw-on-unknown-id in `buildRelationshipProfile`/`buildDialogueContext`/`computeContextBoosts`/`describeHostReadiness` (vs SF-3's silent degradation); `RESIDENTS[id].name` unguarded in `deriveResidentChapter`'s bridging branch for out-of-registry met ids (unreachable via production callers); `JournalDrawer` outside `SceneErrorBoundary` (blast-radius note); null `npcMemories` element crash (chassis parity; sanitizer covers the load path); NaN boost propagation (`Number.isFinite` guard); `getRelationshipTier(NaN)` → 'kindred' fallthrough.

## R-11 (P3 · SF-1) — phantom "guarded" bonds from the synthetic fallback
Fresh world: 7 of Arthur's 9 notable bonds are model defaults (10/10 → `guarded`) with no persisted record; zero production consumers today; rises to P2 if a social-web UI renders `notableBonds`. Recommend evidence-gating `getNotableNpcBonds` before any social-web UI.

## R-12 (P3 · SF-2) — invitation framework polish
`day_end` missing from the reason map; SF2-01 hardcoded (cannot catch future reasons — e.g. LR-3's `offer_phase_closed` will land silently un-mapped); header lists five canonical writers (six is correct); three tier-ranking copies (compile-pinned, runtime-duplicated); non-defensive registry host lookups; past-window cancel intent stamp (design-accepted); cap-12 eviction interplay — cancellation spam can grind completed-visit evidence and erase a tradition seed (doc 22 accepts evidence-TTL; **design decision recommended** on whether cancels should be cheaper ledger rows than completions); `activities.ts:300` literal `.slice(-12)` (pre-existing drift risk).

## R-13 (P3 · SF-3/SF-4) — semantics and hygiene
"Latest visit" = last array element in seed/chapter text vs `Math.max` in `lastCompletedVisitDay` (divergence under non-chronological history — corruption-only); echo memory spec duplicated ×3 (drift would silently break the mention flip); R2 uniform-boost wording overstates; `requiresWitnessedEvent` first-match false negatives (unused predicate — latent for SF-D9 content); stale `scripts/topic_snapshot_runtime.json`; unused `getTopicHistoryEntry` import (phantom edge); SF4-04 vacuous; F-ENTER-1 remains deferred by design (doc 09 §4).

## R-14 (P3 · UI) — journal polish
One-off `text-[#7A6A5B]` at 4.44:1 contrast (below AA for 12 px; the `text-espresso-muted` token gives 5.56:1) + token-discipline skirt; unprecedented `italic` (design confirm); straight-vs-curly apostrophes inside one surface; "a kind word is still owed" tone (zero-FOMO constitution); chapter invisible to read-tracking (by design — recorded).

## Pre-existing chassis observations (not SF; recorded for the record)
Sanitizer drops invalid invitation-history rows **silently** (no warning — asymmetry vs every other drop; systemic-reliability doc 03 §7 says every drop warns); `journal.ts` W5 localStorage violation unchanged (sanctioned until Phase E5); completion text venue-hardcoding and accept-toast hardcode (owned by LR-3 D6/D9).

## Disposition

| Priority | Count | Disposition |
|---|---|---|
| P0 | 0 | — |
| P1 technical | 0 | — |
| P1 process | 1 | R-07 documented; controls recommended; owner action |
| P2 | 6 | R-01…R-06 with precise one-line fixes; **R-03 before future rift content; R-05/R-06 with or before LR-3's second shared activity; R-01 before LR-3 QA gates** |
| P3 | 8 grouped registers (R-08…R-14 + chassis notes) | batch corrective documentation + test-pin task recommended |
