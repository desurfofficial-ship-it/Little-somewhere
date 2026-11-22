# LR-3 Adversarial Test Matrix

Mission areas A–H. For each: the LR-3 scenario set (doc 06 battery, status **BLOCKED** — implementation absent) and the foundation probes **executed** during this campaign, with reproducible results. Evidence base: `main` @ `8e08d3b`; probes ran in-memory (`npx tsx -e`) by independent specialists; QA-F pins are committed (`src/game/lr3qa-foundation.test.ts`).

Status legend: PASS / FAIL / BLOCKED / INSPECTED.

## A. Invitation eligibility

| # | Scenario | Status | Evidence |
|---|---|---|---|
| A-1 | Clara offers within morning window | BLOCKED (LR3-01/02 — Clara def absent) | prepared spec corrected: OR-reading gate means effective affinity floor is tier-bound 40, not 45 (QA-08) |
| A-2 | Offer unavailable outside window; boundary transitions | BLOCKED (LR3-03/06/11) | phase machinery verified: boundaries 689/690, 959/960, 1109/1110, 1290 (QA-F-01 PASS); Clara afternoon distance 8.938 m > 6.0 blocks today via availability gate (probe PASS) |
| A-3 | Offer does not appear twice; cross-host single slot | PASS (chassis) | QA-F-02: second offer refused `active_invitation_exists` while slot held; LR1-02 |
| A-4 | Invalid invitation state unreachable | PASS (chassis) | sanitizer window clamp/expiresDay re-pin/host check verified (`migrations.ts:1576-1600/1615-1621/1613`); Specialist B adversarial set: active-slot, spacing cooldown (decline does not forgive offer-time stamp), day-advance mid-window archive — all refused correctly (probes PASS) |
| A-5 | Unrelated dialogue selection intact | PASS (chassis) | dialogue suites 75/75 incl. BD10-10/11 golden integrity; golden file metadata-only (no string pins) |

## B. Dialogue correctness

| # | Scenario | Status | Evidence |
|---|---|---|---|
| B-1 | Quartet nodes exist; correct selection per state | BLOCKED (LR3-49–56 — `clara.ts` absent; pattern verified: four `makeBranchingTopic` calls, condition ids, priority ladder) | Nora quartet inspected (`dialogue/invitations/nora.ts`); aggregation + evaluator locations re-based |
| B-2 | Golden snapshot regen with justification | BLOCKED (LR3-56/98) | **corrected math: 86 existing topics → 90** (docs say 85→89 — QA-05); generator validated (`snapshot_topics_runtime.ts`, count 86, indices 81–84 Nora, 85 `everyday_shared_visit_echo`) |
| B-3 | No unreachable/missing states; no generic fallback abuse | BLOCKED (LR3-50/52) | `offer_phase_closed` has no label slot — fallback string would render silently (QA-04; SF2-01 cannot catch it) |
| B-4 | Golden changes intentional | PASS (chassis) | metadata-only golden: no strings pinned; Nora byte-identity obligations land with LR3-87/88 |

## C. Shared interior entry

| # | Scenario | Status | Evidence |
|---|---|---|---|
| C-1 | Player+Clara enter; correct positions; coherent transition | BLOCKED (LR3-13–17) | F-ENTER-1 asymmetry re-verified: `enterBakeryAction` (:2724-2748) reconciliation-free; `setOccupant` single call site (:3051) |
| C-2 | Failed entry leaves no partial state | PASS (chassis, nook) | LR2-03 green; enter is one pure spread; host-unavailable sets no occupant |
| C-3 | Exit/re-enter does not duplicate occupants | PASS (nook) / BLOCKED (bakery) | nook exit clears occupancy (`:3100`)+activeActivity (`:3111`), pinned LR2-04 + QA-F-07 sweep; **bakery exit releases nothing (QA-06b — latent, implementation-owned)** |
| C-4 | Book Nook unchanged | PASS | nook suites green (bookNook 17/17, occupancy 8/8); cross-entry ghost occupant is tick-frozen, load-sanitizer-dropped (Specialist C probes P3a-c — latent only) |

## D. Occupancy & interaction exclusivity

| # | Scenario | Status | Evidence |
|---|---|---|---|
| D-1 | Two actors request one exclusive station | PASS (impossible by design) | single global slot; last-write-wins documented (QA-F-06); overwrite masks rather than refuses — QA-06e pins the semantics |
| D-2 | Hold station vs another requests it | BLOCKED (LR3-23–28 — bakery guards absent) | **adversarially confirmed absent**: oven/knead/share reducers all mutate under a synthetic claimed station (Specialist C probe P4 — kneadedDay/bakeCheckedDay/loafSharedDay written); nook analog correctly refuses (LR2-06) |
| D-3 | Cancellation during reservation | PASS (chassis) | `cancelActiveInvitation` (SF-2) + decline/expire paths all clear occupancy (inventory of 10 clearers verified) |
| D-4 | Interruption during activity; exit while occupying | PASS (nook) / BLOCKED (bakery) | tick reconciler expires mid-window; LRTL-04 (tick never writes occupancy); bakery exit hole = QA-06b |
| D-5 | Failed completion; repeated requests | PASS (chassis) | QA-F-03/05: refusal ladder + duplicate refusal, zero grants; refusal ladder documented (`unknown → no-invitation → host → expired → location → occupant → encounter → already_completed`) |
| D-6 | Release after every terminal state | PASS (chassis) | five cleanup owners inventoried and verified: complete (`activities.ts:326-327`), expire (4 sites), exit (`:3100`), day-advance (`storage.ts:744`), load sanitizer (`migrations.ts:1817-1830`) |
| D-7 | Stale locks / orphaned occupancy | PASS (reachable set) / INSPECTED (latent) | no reachable stale lock today; latent cross-entry ghost + bakery exit asymmetry recorded (QA-06b, QA-06c) |

## E. Activity completion

| # | Scenario | Status | Evidence |
|---|---|---|---|
| E-1 | Valid completion (Clara, venue-true text) | BLOCKED (LR3-44/45/46) | hardcodes confirmed live (`activities.ts:214/223/231/281`) — a bakery completion would journal book-nook text (QA-06a) |
| E-2 | Duplicate/interrupted/invalid/repeated completion | PASS (chassis) | QA-F-03/04/05; purity + atomic single-spread commit verified |
| E-3 | Correct relationship/shared-history/memory effects | PASS (chassis) | affinity/reliability clamped, daily-cap bypass pinned (LR2-09/10); host-only NPC memory; journal `mem_lr_*` at head; world-event dedupe; **undocumented +1 `favorsCompleted` (QA-11)** |
| E-4 | No unrelated side effects | PASS (chassis) | completeSharedActivity writes neither `bakeryState` nor `nookState` (probe); bakery reducers disjoint; **refused completion still burns dialogue topic history (QA-12)** |

## F. Character & presentation

| # | Scenario | Status | Evidence |
|---|---|---|---|
| F-1 | Clara presence/positioning/rig | BLOCKED (LR3-63; D8) | three Nora-hardcoded scene regions verified at current anchors (rig :977-994, routing :1560-1575 incl. `NOOK_OCCUPANT_APPROACH_POS` :1567, sync :2371-2428) |
| F-2 | Click routing targets correct actor/activity | BLOCKED (LR3-24/63) | App.tsx string-literal routing (`:381-392` claimed-chair reroute) verified; PR #20's label refactor will churn this region (hazard E-F4) |
| F-3 | Entry/exit leaves no stale visual state | INSPECTED | scene-layer only; occupant rig target-id == `occupancy.residentId` contract proposed (Specialist C F-7) |
| F-4 | No duplicated scene implementation | INSPECTED | D8 parameterization scope = exactly three regions; nook-specific assumptions itemized (rig id, parent group, toast text, literals, selector suppression missing in bakery selector) |

## G. Persistence & deterministic behavior

| # | Scenario | Status | Evidence |
|---|---|---|---|
| G-1 | Save/reload at meaningful points (Clara) | BLOCKED (LR3-66–73/89/90) | persisted triple verified: active invite (clamped) + occupancy (ids + static anchors) + `activeActivity` pointer pair; nothing transient persists |
| G-2 | No invalid partially-completed restore | PASS (chassis) | sanitizer orphan-`activeActivity` clear, occupancy-derived restore, mid-window load archive verified (`migrations.ts:1703-1762`) |
| G-3 | Repeated identical inputs → consistent outcomes | PASS | longrun_stress replay byte-identical; BD10-09 double-run; caveat QA-14e |
| G-4 | v11 saves compatible | PASS (v11→v12 chain green) / **docs claim superseded** | `CURRENT_SCHEMA_VERSION = 12` (QA-02); v11→v12 migration + guard fixtures green |
| G-5 | No transient occupancy persisted | PASS | sanitizer drops occupancy not anchored to a live accepted invite matching `playerLocation`; save-path warning parity partially pinned (gap D-4) |
| G-6 | Long-running stale-state accumulation | PASS | longrun_stress 7 scenarios clean; every LR-3-touchable structure bounded ( Specialist D inventory) |

## H. Regression

| # | Scenario | Status | Evidence |
|---|---|---|---|
| H-1 | Linden Book Nook preserved | PASS | bookNook 17/17, occupancy 8/8, LR2 battery green; helper not yet extracted so byte-identity currently trivial — re-verified at merge time per S8 |
| H-2 | Existing invitation flows | PASS | invitations 32/32 (LR1-01…23, SF2-01…13) |
| H-3 | Other bakery activities | PASS (suite) / FAIL (latent exclusivity) | bakery 18/18; **ritual reducers mutate under claimed station** (probe FAIL vs future S3 contract — expected-absent, implementation-owned) |
| H-4 | Generic shared-activity completion | PASS | activities suite + QA-F-03/04/05 |
| H-5 | Relationship progression | PASS | relationships suite; daily-cap bypass pinned |
| H-6 | Journal & memory behavior | PASS | journal 21/21 + memories suite; caps verified |
| H-7 | NPC routines & simulation time | PASS | simulation/storylines/everyday/community suites green; resident-generic indoor tick-skip verified |
| H-8 | Save/load & deterministic replay contracts | PASS | storage 21/21, save-integrity 37/37, migrations-guard 5/5, BD10-08/09, longrun_stress |

## Executed adversarial probe register (highlights)

| Probe | Attempt | Result |
|---|---|---|
| C-P4 | Claim bakery station synthetically, run oven/knead/share | All three mutate bakeryState (S3 contract absent — reserved) |
| C-P5a | Player adjacent to claimed `bakery_seat_cafe_west` sits | **Sits in Clara's chair** (suppression absent — reserved; contrast nook refusal) |
| C-P5d | From inside nook, sit bakery's indoor seat | **Sits + teleports playerPos cross-venue while `playerLocation` stays nook** — real latent bug (QA-03); unreachable via shipped UI (venue-scoped raycast/selectors) |
| C-P3a/b | Enter bakery while nook occupant live | Occupancy survives + host hard-skipped frozen (latent; load sanitizer would drop) |
| A-P1b | Complete twice on same un-committed world | `ok:true` twice — pure function; caller commit is the dedupe point (documented, QA-13b) |
| A-P6 | Pre-seeded completion memory + host in active encounter | Refused `host_unavailable` with reading toast (guard-order nuance QA-13a) |
| B-probe | Boundary minutes through `canOfferInvitation`/`getTimePhase` | 689→morning, 690→afternoon; Clara 690+ refused `host_unavailable`; 690–719 dead zone on accepted windows confirmed (documented as-built) |
| D-P5 | Day-advance with live visit | history row `{outcome:'expired', reason:'day_end'}`; occupancy/active/act all null (now pinned QA-F-07) |
| D-V7 | longrun_stress harness | 7 scenarios clean; replay byte-identical; npcMem ceiling exactly 140 |

**Matrix conclusion**: the chassis passes every adversarial probe that can execute today; every LR-3-specific scenario is BLOCKED with a prepared, corrected specification. The single executed FAIL-grade evidence (D-2/H-3) is the confirmed absence of reserved LR-3 guards, not a chassis defect.
