# LR-3 Regression Report

Regression assurance across the systems LR-3 will touch, executed on `main` @ `8e08d3b`. Every result is first-hand (campaign run) unless marked otherwise.

## 1. Linden Book Nook (LR-2) — regression-safe

- `npx tsx --test src/game/bookNook.test.ts` → **17/17 PASS**
- `npx tsx --test src/game/occupancy.test.ts` → **8/8 PASS** (LR1-15, LR2-01…04b/bis, LR2-15/16: enter/exit claim pairing, exit-keeps-invite, sleep ejection, save/reload round-trips)
- LR2 rows inside `activities.test.ts` (suppression, no-side-effect, duplicate, affinity) → green within the 73-test activity/invitation run
- `enterNookAction`/`exitNookAction` behavior unchanged on `8e08d3b` (regions :3020-3094 / :3096-3115); `setOccupant` still has exactly one production call site (:3051) — the F-ENTER-1 refactor has not begun, so byte-identity currently holds trivially; the mandatory re-verification point is the D5 slice (LR3-19/72 analogs).
- One latent note: cross-entry ghost occupant (nook occupant live while entering another interior) is tick-frozen and load-sanitizer-dropped — unreachable through shipped UI today (probes C-P3a-c).

## 2. Bakery activities (existing content) — regression-safe in behavior, exclusivity absent as reserved

- `npx tsx --test src/game/bakery.test.ts` → **18/18 PASS** (roster/day purity, seat data, reducer semantics)
- Ritual reducers verified: bake (:2800-2837), knead (:2843-2882), share (:2888-2945), notes (:2948-2994, correctly guard-free per spec)
- Adversarial: under a synthetic claimed station all three rituals mutate (S3 guards absent — the reserved LR-3 surface; tracked QA-06, not a regression)
- Notes shelf unaffected by any claim path (verified guard-free by design)

## 3. Shared-activity framework — sound, pure, idempotent

- `npx tsx --test src/game/activities.test.ts src/game/invitationFramework.test.ts …` (73-test run) → **PASS**
- New QA pins: `npx tsx --test src/game/lr3qa-foundation.test.ts` → **8/8 PASS** (QA-F-01…08: phase boundaries, 719 cap, refusal ladder, purity/atomicity, duplicate refusal, occupancy semantics, day-advance sweep, bakery seat contract)
- Transaction verification highlights: single-assignment commit spread (memories + npcMemories + worldEvents + npcRuntime + invitations + occupancy + activeActivity together); input world byte-identical after success and referentially identical after refusal; duplicate completion refuses with zero grants; day-advance force-archive atomically clears occupancy + activeActivity + active invitation with history row `expired`/`day_end`.

## 4. Relationships & persistence — green; baseline now v12

- `npx tsx --test src/game/save-integrity.test.ts src/game/migrations-guard.test.ts src/game/storage.test.ts` → **63/63 PASS** (save-integrity 37 incl. SR-7 + SR-9e + tombstone contract; storage 21; migrations-guard 5 — chain-tip structural guard adapted automatically to v12)
- LR persistence: `invitations/invitationFramework/occupancy/activities/lr-tick-load/journal/memories` run → **78/78 PASS**
- Schema status: `CURRENT_SCHEMA_VERSION = 12` (`migrations.ts:141`) — PR #19 added `communityProjects` + `plots[].waterStreak` with `migrateV11ToV12`; **the LR-3 docs' "v11 frozen" framing is superseded (QA-02)**; the D7 registry-only plan itself re-validated (LR-3 adds zero persisted fields; stop-rule intact).
- G-2 integrated gate verified by inspection: structural future-version refusal via `schemaVersion` (`storage.ts:74-88`), tombstone-before-rewrite with future payloads never rewritten (:135-149), autosave block while latched (:570-572), `resetWorldState` clears (:583-590). Direct refusal-branch unit pins remain a gap (D-1/2) — spec prepared.

## 5. Simulation behavior & determinism — green

- `npx tsx --test src/game/build10-recovery.test.ts src/game/simulation.test.ts src/game/storylines.test.ts src/game/everyday.test.ts src/game/community.test.ts src/game/progressionVisuals.test.ts src/game/environment.test.ts src/game/bakery.test.ts` → **85/85 PASS** (BD10-08 2000-tick revision/hash identity; BD10-09 tick+dialogue double-run; seeded PRNG; EP-05 derive determinism; weather roll; day cycles)
- `npx tsx scripts/longrun_stress.ts` → **PASS, 7 scenarios, zero invariant violations**; deterministic replay byte-identical; save/reload twin byte-identical; npcMemories ceiling hit exactly at 140 (= 14/resident × 10) proving the cap engages
- Wall-clock/RNG audit: sim core clean; two `Date.now()` session-cooldown gates exist in the action layer (`performFountainWishAction`/`performPondStoneSkipAction`, documented "reset on reload by design") — recorded as a determinism documentation exception (QA-14e), not a defect.

## 6. Full-suite + gates (campaign evidence of record)

| Command | Result |
|---|---|
| `npm test` | **671/671 PASS** (663 inherited + 8 QA pins), 0 fail, 0 skipped, ~23 s |
| `npm run lint` | PASS — 0 errors |
| `npm run build` | PASS — green (pre-existing chunk-size warning only) |
| `npx tsx scripts/check_layer_boundaries.ts` | PASS — boundary intact, acyclic; sanctioned W5 only |

## 7. Regression watch-list for the implementation branch (carry into the 98-battery run)

1. Nook byte-identity after the D5 helper extraction (LR3-19/72) — the one refactor that can genuinely regress LR-2.
2. Nora toast/summary byte-identity after D6/D9 (LR3-87/88) — currently unpinned strings.
3. Golden count math 86→90 (QA-05) — executing the stale LR3-98 expectation would fail spuriously.
4. G-3 sit-range assert ordering vs LR3-24 preconditions (QA-09) — stage within 3.0 m or the test proves the wrong guard.
5. PR #17/#20 merge churn in `actions.ts`/`NeighborhoodCanvas.tsx`/`App.tsx` — re-pin doc 05 §4/§8 anchors after each lands (hazard register).
