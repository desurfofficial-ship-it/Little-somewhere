# 07 — Implementation Record

## 1. Commits (branch `fix/build10-lr-reconciliation`, base `eb95d77`)

| Commit | Scope | Contents |
|---|---|---|
| `f46740f` | fix(build10): D-01 + D-02 | `src/game/simulation.ts` (import + byte-identical step-0 block), `src/game/dialogue/index.ts` (WILDS_TOPICS re-added before INVITATION_TOPICS), `scripts/dialogue-topics-golden.json` + `scripts/topic_snapshot_runtime.json` (regenerated from the live registry, 85 rows) |
| `5bbf2dc` | fix(lr): D-03 | `src/game/invitations.ts` (`isInvitationExpired` = `!isInvitationLive`, decision header), `src/game/occupancy.test.ts` (LR2-04b re-anchored per doc 21 §2.4 + LR2-04b-bis adversarial companion) |
| `69fade1` | test(recovery) | `src/game/build10-recovery.test.ts` (13 tests), `src/game/lr-tick-load.test.ts` (8 tests) — landed from the surviving adversarial red-test drafts |
| `6812bba` | fix(lr): D-04/H-1 | `src/game/activities.ts` (completion-time encounter re-check, refusal with visible toast), `src/game/activities.test.ts` (+2 pins) |
| docs commit | docs + history | docs/architecture/build10-lr-recovery/01–14, decision records 20/21 recovered byte-identically from PR #3, WORKLOG 051–052, HANDOVER, 00-index refresh |

## 2. Production files changed (complete list)

| File | Change | Lines |
|---|---|---|
| `src/game/simulation.ts` | + import, + 8-line step-0 block (byte-identical to 9cde87d) | +10 |
| `src/game/dialogue/index.ts` | + WILDS_TOPICS import, + spread row | +2 |
| `src/game/invitations.ts` | `isInvitationExpired` body → `return !isInvitationLive(...)` + 13-line decision header | net −4 |
| `src/game/activities.ts` | + 20-line completion re-check (encounter signal, refusal + toast) | +20 |
| `scripts/dialogue-topics-golden.json` | + 2 wilds rows, `index` shifts, count 83→85 | +66/−1 |
| `scripts/topic_snapshot_runtime.json` | regenerated (same content as golden) | +65/−1 |

No other production file changed. No dependency changes (`package.json` untouched). No schema change (`CURRENT_SCHEMA_VERSION` stays 11; `migrations.ts` untouched).

## 3. Test files added/modified

| File | Tests | Purpose |
|---|---|---|
| `src/game/build10-recovery.test.ts` | 13 | D-01 tick wiring/idempotency/indoor/rollover/persistence/determinism + D-02 registry/golden/selection |
| `src/game/lr-tick-load.test.ts` | 8 | LRTL-01…07 tick/load matrix (LRTL-01 pins the adopted strict candidate B) + NR-01 discoverability guard |
| `src/game/occupancy.test.ts` | LR2-04b rewritten + LR2-04b-bis added | Decision-B re-anchored staging + strict first-reconcile pin |
| `src/game/activities.test.ts` | +2 | H-1 refusal pins + post-690 completion companion pin |

All expectations derive from: `git show 9cde87d` (Build-10 originals), doc 14 §2.4/§4, doc 16 (LR1-13/14/19, LR2-03/04b/15/16), doc 21 §1.4/§2.4/§2.5, and measured production behavior (BD10-12 bound, NR-01 ramp).

## 4. Measured behavior pins (summary)

- Mina check-in surfaces at ordinary-play interaction **7** (measured); staged starvation pin guarantees selection once competitors drain.
- Nora offer surfaces within **2 interactions of eligibility**, ≤ 10 overall, via the ordinary warm-chat ramp (NR-01).
- Morning offer window `[495, 719]`; 719 inclusive-live, 720 expired; golden/dusk `[…, 1260]`.
- Pre-window hand-staged active: archived exactly once by the first reconciling path; serialize→deserialize agrees; raw-load archives with warning.
- Discovery: 4 zones, radius 5.2, grant = sideFlag + journal memory; idempotent across 20 000-tick soaks; deterministic (byte-identical 12 000-tick double runs).

## 5. Verification commands (authoritative)

```
npm test          # 425/425 pass
npx tsc --noEmit  # 0 errors
npm run build     # exit 0 (pre-existing chunk-size warning only)
```

Mutation checks (each applied, measured, reverted — doc 08 §5): remove tick call → 7 fail; drop WILDS_TOPICS → 10 fail; restore tolerant predicate → LRTL-01 fails; drop INVITATION_TOPICS → 11 fail.
