# LR-3 QA Campaign Status

- **Campaign**: LR-3 — Independent Adversarial QA, Acceptance Engineering & Regression Assurance
- **Date**: 2026-11-22 · **Audited tree**: `main` @ `8e08d3b` (Merge PR #19, everyday gameplay GA-0..GA-6)
- **Method**: five independent specialist audits (activity/transaction, invitation/dialogue, venue/occupancy, regression/persistence, acceptance/integration) executed read-only in parallel, plus first-hand gate runs and in-memory adversarial probes (`npx tsx -e`, no repo writes). No production file was modified. Independent reproduction was built into each specialist brief; cross-specialist consensus is recorded per finding in the defect register.
- **Milestone**: LR-3 = Hearth & Crumb Bakery interior occupancy + `share_morning_pastry`, host Clara, station exclusivity vs knead/share/oven + Clara's schedule gate (doc 14 §10 + doc 15 §3; spec stack `docs/architecture/lr3/01–09`).

## 1. Milestone status

**Design phase: COMPLETE and re-verified. Implementation phase: NOT STARTED on any accessible branch.**

| Question | Verdict | Evidence |
|---|---|---|
| Is the LR-3 specification present and internally consistent? | YES | docs 01–09 on main (PR #13 merged `fab1101`); D1–D10 resolved incl. D10 owner-approved; doc 09 verdict READY FOR IMPLEMENTATION re-audited by Specialist E — substance holds |
| Does LR-3 production code exist? | **NO (mechanically verified, 4 independent agents)** | `share_morning_pastry`, `dialogue/invitations/clara.ts`, `reconcileInvitedInteriorEntry`, `offer_phase_closed`, def fields `offerPhases`/`arrivalLine`/`summaryCompose`, `bakery_cafe_table` — zero hits in `src/`; only reservation comments (`invitationFramework.ts:47-50`) and doc records. `getSharedActivityDef('share_morning_pastry') === undefined` (probe) |
| Is an implementation branch/worktree visible? | NO | remote branch list has no LR-3 implementation branch; sandbox contains no LR-3 worktree; HANDOVER header states implementation "to begin only after the LR-3 documentation reconciliation PR is reviewed and merged by the owner" — PR #13 merged `fab1101` during this campaign, so the start gate is now open |
| Ownership conflict? | NONE | ownership = LR team (operating directive §8, HANDOVER header); PRs #17/#20 verified to respect the chassis reservation (neither touches `invitations.ts`/`activities.ts`/`occupancy.ts`) |

Consequence: per campaign rules §6 and §9, **every LR-3 acceptance requirement is BLOCKED (cannot execute against a missing implementation)**; the campaign's value is delivered as (a) a verified-green foundation audit, (b) a prepared 98-scenario acceptance harness with corrected pre-conditions, (c) a defect register the implementation and platform teams must absorb, and (d) QA-owned foundation regression pins now committed (`src/game/lr3qa-foundation.test.ts`, 8 tests).

## 2. Gate evidence (first-hand, this tree)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run lint` (tsc --noEmit) | **PASS** — 0 errors |
| Full suite | `npm test` | **PASS — 671/671** (663 inherited + 8 QA pins), 0 fail, ~23 s; 75 test files |
| Layer boundary | `npx tsx scripts/check_layer_boundaries.ts` | **PASS** — boundary intact, `src/game` acyclic; known sanctioned W5 (`journal.ts` localStorage) only |
| Production build | `npm run build` | **PASS** — green (~0.9–1.3 s; pre-existing >500 kB chunk warning only) |
| Long-run stress | `npx tsx scripts/longrun_stress.ts` | **PASS** — 7 scenarios clean; deterministic replay byte-identical; save/reload twin continuity byte-identical |
| Targeted suites | activities/bakery/invitations/framework/relationships/occupancy 73/73; persistence/journal/storage 102/102; dialogue/dialogueRegistry 75/75; occupancy/bakery/bookNook/seating 53/53; save-integrity 37/37; migrations-guard 5/5; everyday/community/determinism 85/85 | **ALL PASS** |

## 3. Verified vs unverified

**Verified (PASS — executed)**: full gates above; LR-1/LR-2 invitation lifecycle & tick/load contracts; shared-activity transaction purity/atomicity/idempotency (QA-F-03/04/05); single-slot occupancy semantics + location scoping (QA-F-06); day-advance reconciliation (`expired`/`day_end` sweep, QA-F-07); away-afternoon window cap 719 via the real offer path (QA-F-02); phase boundary minute semantics (QA-F-01); bakery seat data contract (QA-F-08); Clara schedule distances re-derived exactly (morning 1.020 m eligible, afternoon 8.938 m blocked, golden 5.533 m, dusk 0.0 m, cap 719); sanitizer generic host/def validation; SR-7 stationId rule; bounded-growth inventory (all structures capped); determinism pins (BD10-08/09, weather, replay).

**Unverified (BLOCKED — implementation absent)**: all 98 battery scenarios LR3-01…98 (invitation lifecycle incl. `offerPhases`, arrival/interior, station exclusivity, completion with venue-true text, dialogue quartet + golden regen, cross-venue interleaving, Clara-specific persistence round-trips, adversarial matrix). Prepared, corrected specifications exist (doc 06 + this campaign's amendments in the defect register).

**Unverified (INSPECTED-only)**: scene-layer presentation (D8 rig parameterization) — unit-adjacent only; real-GPU/browser QA for the future implementation.

## 4. Blocking defects (summary — full register in `lr3-defect-register.md`)

1. **BLK-1 — LR-3 implementation absent** (owner: LR team). Every acceptance scenario blocked until the implementation branch exists and lands its slices.
2. **BLK-2 — LR-3 doc set's verification basis is stale**: main moved `a80a220` (v11, 528/528) → `8e08d3b` (v12, 671/671) through four merges. Every "WorldState stays v11" claim is factually superseded (`CURRENT_SCHEMA_VERSION = 12` @ `migrations.ts:141`, `migrateV11ToV12` @ `:2426`); D7's registry-only decision itself survives (LR-3 adds zero persisted fields), but the docs need one [Re-based 8e08d3b] amendment pass (schema anchors, ~25 drifted line anchors, golden count 86→90, `invitationFramework.ts` file-map row, types.ts def-field mis-cite). Owner: LR team, docs-only.
3. **BLK-3 — Pre-implementation defect absorption**: QA-03 (cross-venue sit teleport — real current-code latent bug) should be fixed or explicitly waived BEFORE the LR-3 branch exposes the bakery seat surface; QA-08/QA-09 (gate semantics vs battery pre-conditions) must be pinned in the battery.

## 5. Campaign deliverables

| File | Content |
|---|---|
| `lr3-qa-status.md` | this file |
| `lr3-requirement-traceability.md` | requirement → implementation location → test → evidence (S1–S8 + battery areas) |
| `lr3-adversarial-test-matrix.md` | mission areas A–H: executed foundation probes + BLOCKED LR-3 scenarios with prepared specs |
| `lr3-regression-report.md` | Book Nook / bakery / shared-activity framework / relationships & persistence / simulation regression evidence |
| `lr3-defect-register.md` | consolidated register (severity, evidence, repro, owner, status, regression spec) |
| `lr3-integration-readiness.md` | final verdict, blockers, required evidence, merge-order strategy |
| `src/game/lr3qa-foundation.test.ts` (repo root, QA-owned) | 8 additive chassis pins (QA-F-01…08) — safe: touches no file in doc 05 §4's implementation map |

## 6. Process notes (honesty register)

- WORKLOG/HANDOVER entries for this campaign are **deliberately deferred**: both files are high-collision surfaces while PRs #17/#20 are in flight; the QA set travels on its own branch (`qa/lr3-adversarial-assurance`) and the entries should be written by whichever integration pass lands it.
- The QA pins file asserts only design-stable current contracts. It intentionally does NOT assert LR-3 absence, so it will not fight the implementation branch; if any pinned contract changes (e.g., D6/D9 text work, D5 helper), the implementation updates the pin together with its own battery, per doc 06 §0 test-layer rules.
- Sandbox note: the campaign survived a mid-flight environment restore (local refs rolled back to a build-04-era snapshot; file modes flipped to 755). All evidence was re-grounded on `origin/main` after repair (`core.filemode false`, branches re-synced); no evidence predates the repair except where explicitly GitHub-verified (PR #15 merge SHA `3bffc5f`).
