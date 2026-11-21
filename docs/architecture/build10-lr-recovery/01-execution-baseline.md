# 01 — Execution Baseline

**Initiative:** BUILD-10 restoration + Living Relationships reconciliation, re-executed on top of `origin/main` `eb95d77`.
**Branch:** `fix/build10-lr-reconciliation` (cut from `eb95d77`; the identically-named previous branch was never pushed and its commits are unrecoverable — see doc 13 §1).

## 1. Baseline at the integration target (`eb95d77`)

| Check | Result | Evidence |
|---|---|---|
| Full test suite | **401/401 pass**, 0 skipped | `npm test` (tsx --test src/game/*.test.ts src/scene/*.test.ts), 14.4 s |
| TypeScript | 0 errors | `tsc --noEmit` |
| Production build | exit 0 | `vite build`; pre-existing chunk-size warning (>500 kB main chunk) only |
| Schema | WorldState **v11**, `CURRENT_SCHEMA_VERSION = 11` | `src/game/storage.ts` |
| Invitation suite | 19/19 | `npx tsx --test src/game/invitations.test.ts` |
| Occupancy suite | 6/6 | `npx tsx --test src/game/occupancy.test.ts` |
| Dialogue registry | 5/5 against golden (83 topics) | `npx tsx --test src/game/dialogueRegistry.test.ts` |

## 2. Regression confirmation (red tests at baseline)

The surviving adversarial red-test drafts (preserved outside the lost worktree) were executed against `eb95d77` before any fix:

| Suite | Result | Meaning |
|---|---|---|
| `build10-recovery.red.test.ts` | **11 FAIL / 2 pass** | BD10-01…04, 06…08 RED = D-01 confirmed on latest main (discovery dead through the tick). BD10-10…13 RED = D-02 confirmed (registry loss). BD10-05/09 PINs green. |
| `lr-tick-load.red.test.ts` | **7 pass / 1 fail** | LRTL-02…07 + NR-01 hold at baseline (tick/load divergence is characterized, not broken); LRTL-01's failure exposed the deeper save-time archive hazard (doc 05 §2). |

## 3. Post-restoration target state (met)

| Check | Result |
|---|---|
| Full suite after restoration + regression suites landed | **423/423** (401 + 21 new + 1 split LR2-04b/04b-bis) |
| After H-1 completion re-check | **425/425** (+2 H-1 pins) |
| TypeScript | 0 errors at every step |
| Production build | exit 0 at every step |

## 4. Environment

Node v24 / tsx 4 / vite (rolldown) build; repo provisioned with `node_modules` copied from the primary checkout; worktree `/home/z/my-project/fix-wt`; authentication via operator-supplied fine-grained PAT (mode-600, askpass helper, never persisted into repo state).
