# 04 — Adversarial QA Record

- **Date**: 2026-11-22
- **Reviewer**: independent adversarial QA specialist (separate session, no shared implementation context)
- **Scope of review**: the full uncommitted Social Foundation diff on `a80a220`
- **VERDICT**: **ACCEPT-WITH-FIXES** — all three required fixes applied and re-verified; final gates re-run green (**590/590**, `tsc` clean).

## Gate evidence

| Gate | Post-fix result |
|---|---|
| `npx tsx --test src/game/*.test.ts src/scene/*.test.ts` | 590 pass / 0 fail (528 baseline + 62 SF) |
| `npx tsc --noEmit` | 0 errors (run twice) |
| BD10-09 determinism pin + lr-tick-load | green individually and in-suite |
| `vite build` | green (pre-existing EL-10 chunk warning unchanged) |

## LR-3 non-interference (mechanical)

- Reserved-name grep (`share_morning_pastry`, `mem_lr_clara_morning_pastry`, `shared_morning_pastry`, `bakery_cafe_table`, `reconcileInvitedInteriorEntry`, `offer_phase_closed`, `offerPhases`, `arrivalLine`, `summaryCompose`): hits only in docs (reservation maps) and the rules-of-engagement doc-comment. No definition/shadowing anywhere.
- `dialogue/invitations/` contains only `index.ts` + `nora.ts`.
- Chassis + persistence files (`invitations.ts`, `activities.ts`, `occupancy.ts`, `simulation.ts`, `actions.ts`, `migrations.ts`, `storage.ts`) verified UNMODIFIED via `git diff`.
- Import-graph DFS over all src TS files: acyclic; `occupancy.ts` remains a leaf; `activities.ts`'s inlined window check intact.

## Findings and dispositions

| # | Severity | Finding | Disposition |
|---|---|---|---|
| F1 | MINOR | Engine did not clamp `contextBoosts`; hostile inputs (e.g. 10000) could cross category bands (synthetic + real-registry probes). Producer output was always ∈ [0,5], so no player-reachable path. | **FIXED**: engine-side clamp `±5` (dialogueEngine.ts scoring step) — band protection is now an engine invariant. Regression test SF4-03b (hostile 10000/−10000 input cannot cross bands). |
| F2 | MINOR | `deriveOpenVisitSeeds` crashed on an unknown `active.hostId` (corrupted/hand-edited save class); every sibling path guarded. | **FIXED**: unknown host degrades silently (seed skipped). Regression test SF3-02b. |
| F3 | MINOR | Dangling doc references to `04-adversarial-qa.md`. | **FIXED**: this document closes them. |
| F4 | NOTE | Doc-comments claimed "minimum adjacent category gap 6" while the protected invitation/conflict bands sit 2 apart. | **FIXED**: comments re-worded to "boost-eligible bands" (both files). |
| F5 | NOTE | 32 static topic pairs exist where a *legal* ≤5 boost could flip an ordering across categories (authored priorities narrow effective gaps); unreachable today because R1 only ever boosts the single echo topic (max score below all concurrent higher-band winners). | **Accepted with awareness**: recorded in doc 22 §4 as an authoring caution for future `shared_*`-tagged content. |
| F6 | NOTE | `cancelActiveInvitation` reported `previousStatus:'accepted'` for garbage statuses. | **FIXED**: truthful `undefined` for non-machine statuses (cosmetic). |
| F7 | NOTE | `getNotableNpcBonds`/`getSuppressedNpcPairs`/`DialogueContextSnapshot.companionsToday` expose NPC↔NPC facts ungated. Today's consumers are safe (emergent layer gates via `playerKnowsTie`; the snapshot is a QA/debug surface with no UI consumer). The rift-bridging seed intentionally reflects the CURRENT state once the TIE is known. | **Accepted with awareness**: doc-comment added (dialogueContext is a QA/debug surface, not a player-facing projection); doc 22 §3/§4 state the boundary rules. |
| F8 | NOTE | `requiresWitnessedEvent` uses first-match `.find()`: a memory bound only to the second of two same-window events yields false. Zero registry consumers today. | **Accepted**: authoring caution recorded in doc 22 §4. |
| F9 | NOTE | `bun.lock` re-sync (`esbuild 0.25.12 → 0.27.7`) repaired a pre-existing package.json/bun.lock desync; out of claimed scope. | **Split**: committed separately from the feature work. |
| F10 | NOTE | `buildDialogueContext.pendingLiveVisit` re-implemented the live-window check instead of the strict predicate. | **FIXED**: composes `isInvitationLive` (D-03 duality), scoped to this resident as host. |

## Adversarial scenario results (throwaway harness, repo untouched)

| Scenario | Result |
|---|---|
| Contradictory states (affinity 140, trust drift, kindred+reliability 5, bad pair keys) | all detected, zero mutation |
| Cancel with garbage-status / garbage-host active record | no crash; archives `expired`+`player_cancelled`; sanitizer drops bogus rows with warnings on save/load |
| Double cancellation | second call fails gracefully, no duplicate history |
| Cancel with encounter + occupancy + activeActivity staged | visit state cleared, zero rewards byte-identical, input world untouched (pure) |
| Seed derivation over corrupted worlds (missing ledgers, −30 affinity, expired/unknown memories) | no exceptions, deterministic, derive-only |
| Boost computation over malformed topics/conditions/residents | no exceptions; clamp honored; scoping correct |
| Hostile boost 10000 | engine clamp holds (after F1) |
| `requiresWitnessedEvent` future events / maxDaysAgo 0 / non-actors / expired memories | all correct |
| Save round-trip: cancelled entry + over-cap history (15) | reason survives; capped to newest 12; zero unexpected warnings |
| Full-cast × 4-phase dialogue sweep with echo memory + 5-day quiet spell + live visit | 0 crashes; node graphs well-formed; echo selected with surfacing; reunion boost applied; no mutation |
| Knowledge-boundary probes | gate closed without knowledge; `npc_social` content never quoted; only player-known non-expired memories reach player-visible strings |

## Explicitly not verified (honest limits)

- Browser rendering of the Journal chapter line was verified in a separate live-browser QA pass (desktop 1440×900 + mobile 390×844) rather than by this reviewer.
- Full prose proofread of the new docs beyond the load-bearing claims.
- Performance micro-benchmarks (all derivations are per-interaction/per-drawer-open, not per-frame; trivially small).
