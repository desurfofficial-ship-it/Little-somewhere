# 02 — Defect Reproduction

**Method:** every entry below was reproduced or verified on the baseline tree (`545e323`) by direct experiment or direct source inspection. Historical register IDs are cross-referenced; new findings carry SR-IDs. Severity classes: P0 data loss/corruption · P1 serious correctness · P2 meaningful reliability/performance · P3 low-risk/hardening. Severity is assigned per the initiative's priority ladder, not inflated.

---

## SR-1 — `world.memories` is the only uncapped persisted collection (register F-SAVE-3, P2)

- **Severity:** P2 (systemic long-run scaling; today content-bounded, structurally unbounded).
- **Exact source location:** `src/game/migrations.ts:360-391` — `sanitizeMemories` validates shape, dedups by id, but never trims. Append sites: `src/game/actions.ts:458,1081`, `src/game/activities.ts:219`, `src/game/exploration.ts:117` (tick path), `src/game/simulation.ts:640`. Every other persisted collection has a code-level cap (`relationships.ts:19-20`, `memories.ts:33`, `invitations.ts:25`, `storylines.ts:11`).
- **Preconditions:** a save with a large `world.memories` array (hand-edited save, or future content growth — production ceiling today is ≈58 rows because every append uses a static content id `mem_*` and dedups).
- **Reproduction:** benchmark harness (real `serializeWorldState`, real append functions; 30 samples/10 warmups; Node v24.22.3; 3 runs) sweeping `world.memories` from 100 to 12,800 rows.
- **Expected:** save cost/payload either bounded or with a documented growth policy.
- **Actual:** serialize ≈ 75–265 µs fixed + 0.92–0.97 µs/row (R² ≥ 0.991); payload = 15,545 B + 212.1 B/row (R² = 1.0000); 12,800 rows → ~12 ms serialize, ~2.7 MB payload. Round-trip fidelity perfect (ordering, dedup preserved). No gameplay logic reads rows beyond dedup/idempotency presence checks and two cottage-memento visual lookups (`cottageInterior.ts:1816-1817`).
- **Why existing tests miss it:** no test exercises collection size; caps are enforced at append time for other collections but `memories` has no cap to test.
- **Production gameplay vs tooling:** production (long-lived saves); with current content the practical size ≈58 rows (≈0.36 ms serialize) — honest assessment: not dangerous today, structurally unbounded tomorrow.
- **Proposed invariant:** every persisted collection has a deterministic cap enforced at the sanitizer choke point; trimming is newest-first, deterministic, and invisible to gameplay semantics (dedup keys pinned so presence-checks survive trimming).

## SR-2 — Sanitizer can mint an impossible occupancy/`activeActivity` split (new, P1)

- **Severity:** P1 (invalid runtime state produced by the sanitizer itself — the boundary exists to prevent exactly this).
- **Exact source location:** `src/game/migrations.ts:1574-1576` (occupancy cleared when interior location mismatches `playerLocation`) vs `migrations.ts:1523-1538` (`activeActivity` restored from the live active invite without checking occupancy agreement). Production code always sets/clears `occupancy` + `activeActivity` as one unit (`actions.ts:2991-3002,3040+3051`; `invitations.ts:367-376,400-411`).
- **Preconditions:** hand-edited save where `occupancy.playerLocation` disagrees with the active invitation's interior, or occupancy missing while `activeActivity` present.
- **Reproduction:** fixture 20 of the adversarial catalog (`initiative-scratch/fixtures/`) fed through the real load path: occupancy cleared, `activeActivity` survives → runtime state the simulation would never produce; downstream occupancy logic assumes the unit invariant.
- **Expected:** occupancy and `activeActivity` restored together or not at all; mismatch repaired deterministically (drop the unit) with a warning.
- **Actual:** split state accepted silently.
- **Why existing tests miss it:** no adversarial fixture tests the split; existing tests only feed states the simulation produced.
- **Production gameplay vs tooling:** hand-edited/corrupted saves only (no production writer creates the split) — but the load path is the defensive boundary, so severity P1 by mandate ("invalid runtime state").
- **Proposed invariant:** `occupancy` XOR-less unit rule: `activeActivity` present ⇔ occupancy present and consistent; enforced identically on save and load.

## SR-3 — Unknown `npcRelations` pairs accepted and fabricated as live relation data (new, P1)

- **Severity:** P1 (invalid runtime state; garbage re-persisted forever).
- **Exact source location:** `src/game/migrations.ts:612-617` — shape-only check; unknown pair key falls back to `fallbackAffinity = 24` and becomes live relation data.
- **Preconditions:** save containing a `npcRelations` key like `zed:clara` (a pair the resident registry does not define).
- **Reproduction:** fixture in the adversarial catalog → unknown pair loads as a real relation, participates in affinity math, is re-serialized on next save.
- **Expected:** every relation pair must resolve to two registered residents; unknown pairs dropped with a warning.
- **Actual:** fabricated with default affinity, silently.
- **Why existing tests miss it:** tests only produce relation keys from `RESIDENT_ORDER` combinations.
- **Production gameplay vs tooling:** hand-edited saves only; still a boundary-correctness defect (P1 per mandate).
- **Proposed invariant:** every persisted reference resolves to a registry entry; drop-with-warning, never fabricate.

## SR-4 — Unknown storyline keys fabricated as stage-12/active progress (new, P1)

- **Severity:** P1 (invalid runtime state; garbage re-persisted forever).
- **Exact source location:** `src/game/storylines.ts:572,595-597` — unknown keys minted as stage-12/active progress entries.
- **Preconditions:** save with a fabricated `storylines` key.
- **Reproduction:** adversarial catalog fixture → unknown storyline becomes active progress, is rendered by storyline UI, re-persisted.
- **Expected:** unknown storyline keys dropped with a warning.
- **Actual:** fabricated and kept.
- **Why existing tests miss it:** tests only use registry storylines.
- **Production gameplay vs tooling:** hand-edited saves only; P1 boundary-correctness per mandate.
- **Proposed invariant:** same as SR-3 — reference resolution, drop-with-warning.

## SR-5 — No counter ceilings / temporal sanity in the sanitizer (new, P1→P2)

- **Severity:** P2 (hardening of the same boundary; no production writer can produce these).
- **Exact source location:** `src/game/migrations.ts:1066-1070` (day), `1358` (familiarity), `1407-1410` (invitation day fields), `748-749` (encounter `endsMinute`).
- **Preconditions:** hand-edited save: `day = 1e9`, `bellRungCount = 1e9`, `familiarity = 1e9`, invitation `offeredDay` in the future relative to `day`, encounter `endsMinute < startedMinute`.
- **Reproduction:** adversarial catalog fixtures — all five survive the load path; `expiresDay: 1e9` invitation stays live at day 1e8 (register F-SAVE-2 confirmed).
- **Expected:** counters have domains, not just floors (day plausibility bounds, familiarity ≤ 100, `endsMinute ≥ startedMinute`, `offeredDay ≤ day`, invitation day fields equal, window ⊆ [360,1290] — SR-6).
- **Actual:** only `>= 1`-style floor checks.
- **Why existing tests miss it:** no upper-bound fixtures.
- **Production gameplay vs tooling:** hand-edited saves only.
- **Proposed invariant:** every numeric persisted field has a domain (type, range, cross-field relations); violations clamp or drop-with-warning, never silently pass.

## SR-6 — Invitation window minutes range-unvalidated (register F-SAVE-1, P3)

- **Severity:** P3 (hardening; strict predicate then behaves consistently on garbage).
- **Exact source location:** `src/game/migrations.ts:1415-1422,1433` — finite check + `start ≤ end` only.
- **Preconditions:** hand-edited save with `windowStartMinute: -50, windowEndMinute: 1400`.
- **Reproduction:** loads with **0 warnings**; invitation live at minute 360 *and* 1290 (all-day invite); occupancy/`activeActivity` preserved.
- **Expected:** window must satisfy the production writer's domain (`computeOfferWindow` clamps to `[360,1290]`, `invitations.ts:127-152`) — out-of-domain loads are clamped or archived-with-warning.
- **Actual:** accepted as-is.
- **Why existing tests miss it:** no range-violation fixtures.
- **Production gameplay vs tooling:** hand-edited saves only (verified: only production writers are `computeOfferWindow` and `offerInvitation`, both clamped).
- **Proposed invariant:** SR-5's domain rule applied to invitation windows specifically.

## SR-7 — Occupancy misc. fields under-validated (register F-SAVE-2 remainder, P3)

- **Severity:** P3.
- **Exact source location:** `src/game/migrations.ts:1550-1564` — `facing`/`localPos` finite-checked only; `stationId` length-checked only (1555).
- **Reproduction:** bogus `stationId` string survives into runtime occupancy.
- **Expected:** `stationId` resolves to a registered station (reference rule of SR-3); facing is a recognized direction enum.
- **Actual:** accepted.
- **Proposed invariant:** reference/enum resolution as above.

## SR-8 — Duplicate ids un-deduped in `worldEvents`, `activeEncounters`, `invitations.history` (new, P2)

- **Severity:** P2 (hardening; memories ARE deduped, these three are not).
- **Exact source location:** `src/game/migrations.ts:657-753` (worldEvents/encounters), `1454-1491` (invitation history).
- **Reproduction:** adversarial fixtures with duplicated entries — all three collections keep duplicates; runtime duplicate-id invariant broken.
- **Expected:** deterministic id-based dedup (keep-first) mirroring `sanitizeMemories` behavior, with warning.
- **Actual:** duplicates persist and re-persist.
- **Proposed invariant:** id uniqueness enforced per collection at the sanitizer.

## SR-9 — Silent normalization and observability gaps in the load path (new, P2)

- **Severity:** P2 (corruption is *repaired* but silently; operators cannot distinguish a healthy save from a repaired one).
- **Exact source location / evidence:** ~8 of 13 normalization branches emit no warning; season validation is dead code (`migrations.ts:1205-1209`, both ternary branches return the day-derived value); `inventory: null` → empty vs missing → starter kit asymmetry (`1240-1242`); journal ids `""`/`"garbage!!!"` accepted (`367`); negative schema versions load with no warning (`2230` checks `>` only); partially-migrated v11 payloads silently reseed defaults without backup; production discards load warnings entirely (`App.tsx:166`); per-step migration warnings are never merged (`migrations.ts:1733/1792/2051` vs `2165-2240`); corrupt-JSON fallback warning text still says "v7" (`storage.ts:57`).
- **Reproduction:** adversarial catalog run — 32 fixtures: 8 accepted-as-is, 13 normalized, 10 repaired/dropped, 1 rejected→fresh, 0 threw; **7 produced runtime states violating the game's own invariants**; only 10 loads warned; all serious corruptions were silent.
- **Expected:** repair is deterministic, warned, and idempotent; unknown/negative versions are rejected safely or tombstoned; warnings surface through one merged channel.
- **Actual:** silent.
- **Proposed invariant:** every normalization emits exactly one classified warning; unknown versions rejected; warning text matches the actual path taken.

## SR-10 — F-SIM-1 / H-2: pure `stepSimulation` does not clone `residents` (register F-SIM-1, P3 — test-only)

- **Severity:** P3 (purity contract; verified test-only reachability).
- **Exact source location:** clone literal `src/game/simulation.ts:1055-1104` clones 20+ slices but never `residents`; boundary-crossing in-place writer `updateResidentEmotionInPlace` at `simulation.ts:399-401` (`world.residents[id].mood = emotionToMood(nextEmotion)`).
- **Preconditions:** a caller retaining a reference to the input world across pure steps (test fixtures).
- **Reproduction:** real world from `createFreshWorldState`, structuredClone snapshot, pure steps at the production clock rate: **first natural leak at pure step 682**; leaked paths `residents.{jun,toby,pip}.mood` (peaceful→warm) at 682, `residents.nora.mood` at 983 — exactly the register's "4 mood paths". Additional latent aliases mapped: two "immutable" chains from one base share the same `residents` record; `computeWorldSaveRevision` (`storage.ts:226`) hashes `prog.mood`, so a test-only run flips the fixture's autosave fingerprint (cross-contamination between scenarios).
- **Expected:** pure wrapper returns state that never aliases the input's mutable leaves; repeated runs from identical inputs are value-identical AND isolation-complete.
- **Actual:** mood leaves leak into the caller's retained input.
- **Why existing tests miss it:** tests either use fresh fixtures per case or don't compare the input snapshot after stepping; no purity assertion exists.
- **Production gameplay vs tooling:** **test/tooling only** — production runs `stepSimulationInPlace` exclusively (`NeighborhoodCanvas.tsx:2121`, sole call site; verified by grep).
- **Proposed invariant:** the pure wrapper deep-isolates every leaf path any tick writer can touch (minimum: per-resident shallow clone); in-place path ownership documented as intended mutation.

## SR-11 — Journal/UI freshness gap (register F-UX-1, P3 — UX, no state-integrity impact)

- **Severity:** P3 (UX freshness only).
- **Exact source location:** `src/components/JournalDrawer.tsx:52-55` (memo deps `[world, seenKeys]`); tick mutates `worldRef.current` in place (`NeighborhoodCanvas.tsx:2089-2121`; discovery grant `exploration.ts:115-127`); identity changes only in `commitWorld` (`App.tsx:271-274`); step-0 grant discarded (`simulation.ts:640`).
- **Reproduction:** grant a discovery via tick → Pocket Journal shows it only after the next world-committing action; no toast at step 0.
- **Expected:** journal reflects tick-granted state within the same frame it is granted (revision counter or commit-on-grant).
- **Actual:** stale until next commit.
- **Why existing tests miss it:** UI memo behavior not covered by headless tests.
- **Production gameplay vs tooling:** production, cosmetic.
- **Proposed invariant:** journal projection is a pure function of committed world identity — grant paths produce a new commit or bump a revision.

## SR-12 — Per-tick O(n) scan of `world.memories` on the discovery-grant path (new, P3)

- **Severity:** P3 (bounded work today; grows linearly with an uncapped collection — compounds SR-1).
- **Exact source location:** `src/game/exploration.ts:117` — `world.memories.some(...)` executed per tick when the outdoor player is in a discovery zone.
- **Reproduction/measure:** 0.010 ms @100 rows → 0.114 ms @12,800 rows (~8.5 ns/row); steady tick otherwise size-independent (5–7 µs).
- **Expected:** grant check uses a set/index (e.g. `sideFlags` unlock markers) instead of an array scan.
- **Actual:** O(n) scan per candidate tick.
- **Proposed invariant:** per-tick paths must not scan unbounded collections; use keyed lookups.

## SR-13 — Journal read-key cache not re-trimmed on load (new, P3)

- **Severity:** P3. **Location:** `src/game/journal.ts:211` caps `readKeys` at 240 on write; `200-202` does not re-trim on load. **Reproduction:** save with >240 read-keys loads all of them into runtime. **Expected:** load-path trim symmetric with write-path cap. **Proposed invariant:** write-path caps are load-path invariants too (same choke point).

## SR-14 — Journal view rebuilds/maps all rows per commit even when closed (new, P3)

- **Severity:** P3 (minor render cost). **Location:** `src/components/JournalDrawer.tsx:52-55,148,535` — hooks run before the `!open` early return. **Measure:** 79–116 µs + 0.18 µs/row per commit. **Expected:** projection memoized behind `open`. **Proposed invariant:** closed panels cost ~0 per commit.

## Non-reproduced / register-documented items (explicitly not re-classified as fixed)

- **F-ENTER-1 (P3, latent):** verified structurally on current code — only `enterNookAction` (`actions.ts:2960`; reconciliation at 2972-3006) reconciles invitation expiry on room entry; `enterCottageAction` (2112), `enterGreenhouseAction` (2157), `enterBakeryAction` (2664), `enterCopperwheelAction` (3287) have none. Harmless today (no invite-gated activities outside the nook); the HANDOVER §17 contract note stands. Disposition: keep deferred with the contract note; revisit when a second interior activity exists.
- **F-PRED-1 (P3):** backstop verified empirically — `staleInvitationSeen = 0` across ~29,500 stress ticks including invitation-pressure scenarios; strict-predicate unification (D-03) already makes the semantics well-defined. Disposition: defer stands.
- **F-WORLD-1 (P3):** QA-staging methodology note (Sorrel Hollow zone center non-walkable); no code change justified. Documented in doc 09 §H-7.
- **F-ASSET-1 (P4):** ~9.4 MB QA PNGs under `download/asset-qa/` (PR #4 main-only asset work); out of scope per register.
- **F-DOC-1 (historical):** WORKLOG Entry 048 stale test count; history preserved as written.

## Determinism verdict (baseline)

Identical seeds × separate worlds: byte-identical final states on both execution paths (12,000-tick runs, and replay scenario F on the stress harness). The simulation is deterministic today; SR-10 is a purity/isolation defect, not a determinism defect.
