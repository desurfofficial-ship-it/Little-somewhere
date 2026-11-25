# Adversarial QA Report -- Stage 3 Willow Jetty Slice (Deliverable E)

Two independent QA passes were run: (1) a PRE-IMPLEMENTATION adversarial audit of the EXISTING
activity systems (its findings shaped the slice's design rules), and (2) a POST-IMPLEMENTATION
independent review of the exact slice diff by a separate reviewer who did not write the code.
The implementation author is not the only person who decided the work is correct.

## Pass 1 -- pre-implementation audit of existing systems (baseline 052e171)

Findings (all verified against source, repro in the audit session):

| # | Severity | Location | Finding |
|---|----------|----------|---------|
| F1 | MAJOR | actions.ts:2056-2073, 2140-2154 | performFountainWishAction / performPondStoneSkipAction gate spam via module-level `Date.now()` -- breaks the determinism contract for headless replay; cooldown unsaved; module state leaks across tests. New code must gate via WorldState day-stamps (`isDoneToday`). |
| F2 | MAJOR | actions.ts:2074, 2155, 1502, 1659; enabler migrations.ts:1038-1047 | Unvalidated sideFlags reads (`Number(sf[key])`) inject NaN from hand-corrupted saves ("3x" -> NaN counters; sorrel stage resets while completion memory persists). Correct pattern: Number.isFinite guard (communityProjects.ts:80-82). |
| F3 | MAJOR | actions.ts:3700-3723 cookRecipeAction | Ingredients consumed BEFORE output grant; applyItemGrants clamps at MAX_ITEM_STACK -- brewing at 20/20 destroys the ingredient while copy claims storage. |
| F4 | MINOR | actions.ts:2660-2714 harvestPlotAction | overflowIds ignored; toast promises harvest even when the satchel refused. |
| F5 | MINOR | actions.ts:3810-3814 placeFlowerInVaseAction | Vase swap return-path ignores `added` -- returned flower can be silently destroyed at stack cap. Same ignore pattern in readGreenhouseNotesAction. |
| F6 | MINOR | actions.ts:2514/2721/2317 | water/read/cottage reducers lack the playerLocation guard their siblings have -- defense-in-depth gap; new reducers must self-check. |
| F7 | MINOR | actions.ts:1656-1716 sorrel_garden_bed | No daily gate -- project completes in one sitting, against the "three unhurried visits" design. |
| F8 | MINOR | App.tsx:347-359, NeighborhoodCanvas.tsx:2013, environment.ts:150 | commitWorld runs full sanitizer + JSON.stringify per interaction (main-thread stall on mobile); composeEnvironmentState allocates every frame. Pre-existing perf hazard. |
| F9 | SUSPECTED | dailyLettersRead (migrations) | Grows one entry/day forever, deduped but never capped. Verify via long-run stress. |
| F10 | SUSPECTED | inventory.ts:471-473 | addItemToInventory can return negative `added` on in-session corruption; raw callers do not check sign. New reward paths must use applyItemGrants only. |

Verified-clean: completeSharedActivity idempotency; occupancy/invitation load invariants;
host-skip; zero-reward cancel; worldEvent + npcMemory dedupe and caps; inventory sanitizer
clamping; seat exclusivity; Math.random confined to audio (non-sim).

## Pass 2 -- post-implementation review of slice diff e6cf83f (+ fixes 1372b41)

Method: full `git diff origin/main..HEAD` review plus the seams it touches; throwaway probes
in /tmp (7 corruption variants, guard ladder matrix, 726-cell target-selection grid scan,
2000-cast distribution check, serialize/sanitize/deserialize round-trips); gates re-run on the
exact commit.

Verdict: **MERGE-READY** (after the fixes below -- applied in commit 1372b41).

Findings and dispositions:

| # | Severity | Location | Finding | Disposition |
|---|----------|----------|---------|-------------|
| 1 | MINOR | everyday.ts deriveTouchedToday | Fishing never reported in touchedToday (only practice whose day-stamp was unwired). | FIXED: wired via isDoneToday(Number(sideFlags.fishingLastDay), day). |
| 2 | MINOR | fishing.test.ts FISH-18 | Day-2 leg was vacuous (pinned day 2 resolves quiet at index 1; assertions never executed). | FIXED: day 2 chosen as next non-quiet index-1 day; uniqueness + ev_fishing_<day>_2 asserted directly. |
| 3 | NIT | fishing.test.ts FISH-02 | Header claimed a golden pin but only asserted self-consistency. | FIXED: absolute golden table for days 1-5 (locks salt + thresholds + pools; update intentionally on formula change). |
| 4 | NIT | fishing.ts readCounter | Magnitude corruption (1e21) saturates float64 counter. | FIXED: Math.min(floor, MAX_SAFE_INTEGER). |
| 5 | NIT | fishing.ts Guard 2 | Distance guard failed OPEN on missing playerPos. | FIXED: fail-closed (!pos rejects). |
| 6 | NIT | everyday.ts | Stale "all eight practices" comment; "First Cast" tier mislabeled (counter counts catches). | FIXED: comment -> nine; tier renamed "First Catch"; test pins updated. |
| 7 | NIT (SUSPECTED visual) | environmentRenderer.ts rig | Planks may read as floating at raking light (in-engine check not possible headlessly). | MITIGATED: planks lowered to y=0.10; flagged for the next visual pass. |

Verified non-findings (checked, not trusted): zero schema/migration impact (sideFlags day-stamp
survives round-trip as a number; NaN dropped; corrupted strings self-heal; future-schema refusal
untouched; computeWorldSaveRevision dirties on catch AND on quiet-day stamp); guard ladder
correct and honest (all guard failures return the same world reference; no time spent; seated
players cannot cast; started shared activities block; dialogue modals block input); overflow
honesty (no consume-then-fail; 20->20 verified); journal memory idiom consistent (prepend,
cap-96 evicts oldest, fishing rows survive); witness memories replicate the stone-skip
discipline (per-resident cap enforcement on insert; detail.personalItemId round-trips through
sanitizeMemoryDetail); determinism clean (no Date.now/performance.now/Math.random/Object.values
anywhere in the module; catchIndex persisted; all env inputs derive from persisted state);
target-selection no harmful shadowing (bench CTA wins at its approach point 2.67 > 2.4;
jetty CTA wins at the stand point); renderer rig leaks nothing (built after exteriorRoot
exists; hides indoors via the existing visibility toggle; +5 draws / +0 programs claim
accurate); gift chain end-to-end (all 5 fish giftable; jun.loved mirror_carp, clara.liked
silver_dace, barnaby.liked sun_perch, sora.liked rain_trout confirmed at runtime; per-resident
daily gift cap still enforced); design/identity clean (no quota/streak/FOMO; renewable loved
gift has exact precedent in smooth_river_glass).

## Exact commands and results (local verification only -- no CI claims, no real-device claims)

- Baseline 052e171: `npm run lint` clean; `npm test` 738/738; `npm run build` OK.
- Slice e6cf83f: `npm run lint` clean; `npm test` 758/758 (738 baseline + 20 FISH cases);
  `npm run build` OK (941 ms, pre-existing chunk-size warning only).
- QA fixes 1372b41: `npm run lint` clean; `npm test` 758/758; `npm run build` OK.

## Remaining risks / limitations (honest)

1. Headless software-WebGL probes are NOT real-device verification. The scene rig was reviewed
   numerically (+5 draw calls, 0 programs, exteriorRoot parenting) but not screenshotted on an
   iPhone/Android browser -- needs the standard on-device visual pass.
2. QA finding F8 (commitWorld sanitizer on every interaction) is pre-existing and unfixed here
   (App.tsx is LR-3-locked); fishing interactions commit at most once per day so they do not
   worsen it materially.
3. Pass-1 findings F1-F7 in EXISTING systems are untouched (their files are LR-3-locked or
   out of slice scope) -- recorded for the owning teams.
4. The golden table (FISH-02) intentionally pins the resolution formula; changing salt,
   thresholds or pools requires a conscious test update.
5. No new dialogue topics were added (golden-topic file is LR-3-owned); resident reaction to
   catches currently arrives via the existing gift-reaction + witness-memory/gossip machinery.

---

## Pass 3 -- post-merge re-verification + browser visual smoke (2026-11-25, follow-up session)

State under test: merge commit `31ae947` (integration of origin/main `42a8c7c` -- PRs #26/#27/#28/#32
-- into this branch). The gate runs above predate that merge, so the combined state was re-proven:

1. **Gates re-run at `31ae947`**: `npx tsc --noEmit` clean; `npm test` **774/774 pass, 0 fail**
   (40.9s) -- 738 baseline-at-`42a8c7c` lineage + QA-03 battery (6) + spatial battery (10) +
   the 20 FISH cases; `npm run build` green (pre-existing chunk-size warning only).
2. **Merge conflict resolution verified**: the single conflict (`src/game/actions.ts`) resolved
   correctly -- fishing dispatch intact (import `:46`, dispatch `:1970-1974`) while QA-03's
   categorical sit guard from #27 remains present; both batteries pass together.
3. **LR-3 boundary re-confirmed against the live PR #29 diff**: LR-3's `actions.ts` hunks
   (`:42` imports, `:906-913` accept toast, `:990-1003` sit guard) and `types.ts` hunk
   (`BakeryInteractableId` only) remain disjoint from this branch's hunks (`actions.ts`
   `:46`/`:1967-1974`; `types.ts` union ends `PropInteractableId`/`PersonalItemId`).
4. **Browser visual smoke** (headless Chrome 158, production `vite build`, software WebGL --
   NOT real devices): full loop executed -- Begin day -> save staged (playerPos `(-0.8, 18.2)`,
   day 2, minute 780) -> Continue Day 2 -> in-range jetty prompt click -> cast resolves with the
   **+1 Silver Dace honest grant chip** and the "Memory saved: A Silver Dart" journal toast
   (HUD: Day 2 · 13:23 · Afternoon · Spring · Sunlit). Desktop 1440x900 + mobile 390x844: card
   fits, zero overflow. Evidence committed under `download/asset-qa/stage3-willow-jetty/`
   (see `metadata.jsonl`). This closes the pre-merge "no screenshots" limitation above at the
   headless level; the real-device pass remains the owner's standard step.
