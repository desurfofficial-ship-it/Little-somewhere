# 08 — Long-Run Stress Testing

**Scope:** the committed stress harness (`scripts/longrun_stress.ts`), what it drives, what it asserts, and its results on the final branch. Verification infrastructure for doc 03 §5.

## 1. Harness design — real production pathways only

The harness contains **no parallel fake simulation**. Every tick and transition goes through production code:

- **Ticks:** `stepSimulationInPlace` at the production dt clamp (the same entry the frame loop uses).
- **Day boundaries:** real `advanceToNextDay` at the `DAY_END_MINUTE` clamp (clamp-dwell model, no midnight wrap).
- **Actions:** real reducers — invitation offer/accept/decline/complete/expire (`offerInvitation`/`acceptInvitation`/…), activity/interrupt reducers (`interruptSocialEncounter`), bell/fountain/pond interactions, exploration discovery grants via the tick path.
- **Persistence:** real `serializeWorldState` / `deserializeWorldState` for every save/reload cycle.
- **Deterministic staging:** hosts are raised to tier-eligible affinity through the same relation reducers the game uses, so the invitation lifecycle (with `INVITATION_HISTORY_CAP=12` rollover) is genuinely exercised.

**Documented setup deviations (the only non-production code):** seed-free affinity staging and player-position warps to place the agent in discovery zones — both are test-fixture setup, not simulated behavior.

## 2. Scenarios

| ID | Scenario | Config | Ticks |
|---|---|---|---|
| A | Extended ordinary life | seed 20260214, daily schedules, rests | 2,000 |
| B | Persistence endurance | save/reload every 200 ticks + no-reload twin | 2,000 ×2 |
| C | Journal pressure | clockRate 30, discovery warps (high journal activity) | 2,000 |
| D | Invitation pressure | RNG offer/accept/decline/expire cycles | 2,000 |
| E | Boundary transitions | clamp-dwell + `advanceToNextDay` cycles | 1,500 |
| G | Interrupted progression | 17 real interruptions + 10 save/reloads | 1,500 |
| F | Deterministic replay | scenario A config ×2 separate worlds, 10 checkpoints | 2,000 ×2 |

(`--quick` reduces checkpoint counts; the full run is the record of evidence below.)

## 3. Per-tick / per-cycle invariant sweep

After every tick and every reload the harness asserts, with **first-violation reporting** (scenario, tick, offending paths — enough to reproduce, never just "it crashed"):

1. Every persisted reference resolves (invitation participants, relations, occupancy, stations, storylines).
2. Ids unique within every collection (`worldEvents`, `activeEncounters`, `invitations.history`, `memories`, `npcMemories`).
3. Numeric domains hold (finite, floors, ceilings, cross-field).
4. Occupancy/`activeActivity` coherence per the doc 14 §4.3 anchor.
5. Invitation lifecycle valid per the strict predicate (`isInvitationLive`); nothing non-live survives a tick or a reload.
6. Journal/memory rows: unique ids + domain-valid day fields. *(Honest scope note, adversarial-review finding 9: the harness checks uniqueness + day-validity + byte-stable replay equality; it does not assert ordering monotonicity across appends — ordering is enforced by construction at the single append path and verified by the save/reload round-trip tests. Doc 03 §5 invariant 6 is worded accordingly.)*
7. Collection caps engage exactly (`npcMemories` saturates at 140 in scenario D; `world.memories` ≤ 96 everywhere; history ≤ 12).
8. Deterministic replay: twin runs byte-identical; save/reload twin byte-identical to the no-reload twin (drift-free).
9. No unexpected mutation of retained inputs on the pure path (purity regression test in the unit suite; the harness's replay twins additionally catch input contamination).

## 4. Results (full run, this branch, Node v24.22.3)

| Scenario | Ticks | Rests | Save/reloads | Wall time | Payload growth | npcMem | invHist | Verdict |
|---|---|---|---|---|---|---|---|---|
| A_extended_ordinary_life | 2,000 | 1 | 0 | 109 ms | 17,763→40,559 B | 5 | 0 | PASS |
| B_persistence_endurance | 2,000 | 2 | 10 | 111 ms | 17,772→65,128 B | 52 | 1 | PASS |
| C_journal_pressure | 2,000 | 5 | 0 | 60 ms | 17,763→68,529 B | 61 | 0 | PASS |
| D_invitation_pressure | 2,000 | 7 | 0 | 91 ms | 17,772→110,182 B | 140 (cap) | 2 | PASS |
| E_boundary_transitions | 1,500 | 3 | 0 | 47 ms | 17,772→58,096 B | 48 | 1 | PASS |
| G_interrupted_progression | 1,500 | 3 | 10 | 47 ms | 17,772→97,620 B | 125 | 1 | PASS |
| F_deterministic_replay | — | — | — | — | — | — | — | byte-identical = true (10 checkpoints/run) |
| B_twin_continuity | — | — | 10 | — | — | — | — | twin byte-identical = true |

**Zero hard invariant violations across the entire suite.** The baseline investigation's ~29,500-tick run found nothing because the baseline is healthy; this committed harness keeps it that way (its value is regression protection, not defect discovery — doc 04 Change 4).

## 5. How to run

```
npx tsx scripts/longrun_stress.ts          # full run (evidence of record)
npx tsx scripts/longrun_stress.ts --quick  # reduced checkpoints (CI-style smoke)
```

Exit code 1 on any violation, with the first offending tick/transition printed.
