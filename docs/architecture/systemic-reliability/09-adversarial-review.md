# 09 — Adversarial Review

**Scope:** the formal adversarial QA loop over the initiative diff. Two rounds: (1) the implementation-time loop (corrections made while landing Changes 1–4), (2) the independent post-implementation review by a read-only adversarial reviewer (Agent E role), plus the repair round it triggered. The reviewer examined the actual diff and source, ran the suites and probes itself, and was permitted to reject.

## 1. Implementation-time loop (round 1)

During landing of the sanitizer work, the audit's proposed occupancy/`activeActivity` **unit-clear was rejected** against the contract of record (doc 14 §4.3 / doc 16 §3, regression LR1-15b): `activeActivity` anchors to the live active invitation, not to occupancy. The shipped rule (orphan-clear + warning; occupancy anchored; deterministic restore; mid-visit survival) is pinned by the SR-2a/SR-2b/SR-2c tests — the SR-2a red-phase counterpart asserting the unit-clear was flipped to the contract-of-record behavior. A second correction in the same loop: the npcRelations reference rule must accept gameplay-created pairs of registered residents (the tick engine creates them via `applyNpcSocialRelationInPlace`), dropping only pairs naming **unregistered** ids.

## 2. Independent review round (round 2) — mandate and verdict

The independent reviewer (read-only, scratch work confined to /tmp) was mandated to challenge root causes, attack the new sanitizer rules with hand-built payloads through the real load path, hunt over-rejection of valid data, verify determinism/perf confinement, audit harness fidelity, and reconcile docs against code. Its verdict: **PASS WITH CONCERNS** — no code-correctness blocker; every claimed enforcement it attacked held; several documentation contradictions and genuine silent-drop paths required repair before delivery.

### Independently reproduced claims (reviewer's own runs)

- Red-first: baseline `545e323` + the test commit's suite → **26 tests, 6 pass, exactly 20 fail**.
- Full suite 453/453 at review time; tsc 0; save-integrity 27/27; harness clean with byte-identical replay/twins; benchmark payload bounded at 38.2 KB, fixed points stable.
- Purity/perf: per-resident clone **0.44 µs** (doc claims ≈0.43); clone confined to `stepSimulation` (`simulation.ts:1059-1068`); `sanitizeWorldState` called only from save/load paths (no tick-path cost); no new `Math.random`/`Date.now`.
- Production ceiling ≈58 credible → 96-cap headroom holds.
- Sanitizer's arthur-pair fallback exactly matches `getNpcRelation`'s on-miss fallback (`relationships.ts`) — load path agrees with runtime fabrication.

### Attack results (2a–2g, all through real `deserializeWorldState`)

| Attack | Result |
|---|---|
| 2a over-cap memories (pre-deduped, reversed, malformed-interleaved) | enforced, deterministic; caveat: trim is an order-preserving head slice, not timestamp-aware → warning reworded (finding 6), doc 03 §1 J-1 clarified |
| 2b relation key attacks (`zed:clara`, whitespace, case) | unregistered dropped+warned; **caveat found: re-keyed duplicate silently overrode the canonical entry → fixed (AR-2)** |
| 2c duplicate ids, richer-second-entry | keep-first enforced with warnings; production-consistent (writers are id-guarded) |
| 2d invitation day fields as strings/NaN/floats | rejected/clamped before confusion, warned |
| 2e occupancy unit-rule probes | matches doc 14 §4.3; **caveat found: outer occupancy drops were silent → fixed (AR-1/AR-1b)**; docs corrected to the shipped rule (finding 1) |
| 2f starter-memory-only saves | unchanged, no double-add, no reorder, no warnings |
| 2g fixed-point round trips ×3 worlds | byte-identical |

## 3. Review findings and dispositions (each resolved before delivery)

1. **Docs contradicted shipped SR-2 behavior** (doc 02 §SR-2 expected-invariant, doc 03 §2 unit-rule row, doc 04 repair-decisions line still described the rejected unit-clear). **Fixed:** all three rewritten to the shipped rule (§3 of doc 06); the code and tests were already correct.
2. **SR-5 declared but partially implemented** ("all P1/P2 implemented" was false as written; reviewer reproduced `day=1e9`, `familiarity=1e9`, `bellRungCount=1e9` loading warning-free; facing "enum" unenforced). **Disposition (evidence-based, per finding):** the invitation temporal-sanity subset is implemented and tested (window clamp, `expiresDay` re-pin, `offeredDay ≤ day`, `endsMinute` normalize). The generic counter ceilings were **rejected as mis-declared targets**: production writers leave `day` (advanceToNextDay +1), `familiarity` (relationships delta accumulation), and `bellRungCount` (+1 per bell action) legitimately unbounded — clamping them at the boundary would corrupt legitimate long saves and contradict runtime behavior. Ceilings exist exactly where production has them (affinity −50..100, reliability 0..100, tension 0..100, `dailyAffinityGained` 0..20) and are enforced. `occupancy.facing` is a numeric angle in production (finite-checked), not a direction enum — docs corrected. Pinning test AR-4 freezes this accept-behavior. doc 03 §2 rows corrected accordingly.
3. **doc 04 commit-sequence ≠ git log; docs 05–11 missing; two scripts untracked.** **Fixed:** doc 04 rewritten to the actual history (journal cap lives inside `7a24293` with the boundary work); docs 05–11 created; `scripts/journal_bench.ts` and `scripts/qa_sri_browser.sh` committed with the documentation.
4. **Silent drops violated the "every drop warns" contract** (occupancy outer drop; legacy v1/v3 per-step warnings swallowed — an over-cap memories trim inside a v1 save was invisible; save-path sanitizer repairs constructed and discarded). **Fixed in code, test-first (AR-1, AR-1b, AR-3, AR-5):** outer occupancy drop warns; `migrateV1ToV2`/`migrateV3ToV4` accept and merge the caller's warnings array; `serializeWorldState` takes an optional warnings sink and otherwise surfaces repairs on `console.warn` with the shared `[little-somewhere save]` prefix (healthy saves verified silent).
5. **doc 03 §2 schema-version row wrong for future versions.** **Fixed:** future (> 11) → conservative degraded load + tombstone, never rewritten; non-integer/negative → reject-to-fresh.
6. **"newest kept" trim wording could be false for non-conforming payloads.** **Fixed:** warning now says "first rows kept" (order-preserving head slice); doc 03 §1 J-1 wording aligned.
7. **doc 01 §6/§9 stale finding numbering** conflicting with the canonical SR-1..SR-14 of doc 02 (plus one orphan item, "per-save sanitize cost", absent from doc 02 — now recorded as bounded-and-understood in doc 05 §5). **Fixed:** doc 01 renumbered to the canon.
8. **doc 04 file-list inaccuracy** (`src/App.tsx` claimed; the console surface lives in `storage.ts`). **Fixed.**
9. **Harness fidelity note:** real pathways confirmed; doc 03 §5 invariant 6's "ordering" claim exceeded what the harness asserts (uniqueness + day-validity + replay equality). **Fixed:** doc 03 §5 and doc 08 §3 worded to what is actually asserted.

## 4. Repair-round regression tests (test-first)

`src/game/save-integrity.test.ts` AR-1..AR-5 (6 tests): red on the un-repaired boundary — AR-1/AR-1b (missing occupancy warnings), AR-2 (last-processed override), AR-3 (swallowed v1 trim warning), AR-5 (discarded save-path warnings) — green after the fixes; AR-4 pins the intended accept-unchanged behavior (green by construction, as a documentation-pin test). Full suite 453 → **459**; tsc 0; harness re-run clean.

## 5. Mutation evidence register

| Correction | Mutation applied | Observed | Restored |
|---|---|---|---|
| Change 1 (sanitizer contract) | whole red suite run against pre-fix boundary (`7e6b056`) | 20/26 fail for the expected reasons | 27/27 green (`7a24293`) |
| Change 2 (memories cap) | cap block removed from `sanitizeMemories` | SR-1 load test, SR-1 save-path test, storage self-heal test fail (3) | green |
| Change 3 (residents clone) | clone literal removed from pure wrapper | purity regression test fails (1) | green |
| AR-1/1b (occupancy warnings) | outer else-if removed (= pre-fix state, demonstrated red-first) | 2 fail for the expected reasons | green |
| AR-2 (re-key collapse) | written-set removed (= pre-fix state) | keep-first assertion fails | green |
| AR-3 (legacy warning merge) | warnings param dropped (= pre-fix state) | v1 trim warning assertion fails | green |
| AR-5 (save-path sink) | sink/console.warn removed (= pre-fix state) | sink assertion fails | green |

(All mutations were applied, observed, and reverted with a clean tree verified before and after; the red-first runs double as the mutation evidence for the corresponding fixes.)
