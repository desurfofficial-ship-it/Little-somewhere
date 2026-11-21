# LR-3 Acceptance Test Plan

- **Date**: 2026-11-22
- **Status**: Phase Four deliverable (initiative §5). Test **specification** only — no production or test code is written on this branch (initiative §5 preamble: actual test files require explicit authorization). Docs-only.
- **Verification basis**: `origin/main` @ `962fb07` (447/447 re-verified 2026-11-22). Existing test coverage cites real, named tests on that tree; proposed coverage cites file + case ids this plan introduces for the implementation branch.
- **Format authority**: follows `16-lr1-lr2-acceptance-test-plan.md` conventions; battery obligations from `15-implementation-readiness-checklist.md:75-90` as inherited by doc 03 §3.
- **Completion rule**: an implementation may claim LR-3 complete only when every scenario below has an executed, passing test (or a documented, justified N/A), the full suite is green, and the golden-snapshot regeneration carries its written behavioral justification.

---

## 0. Legend and functions

**Requirement IDs** map to doc 03 §1 scope items: `R3-S1` occupancy · `R3-S2` activity def · `R3-S3` station exclusivity · `R3-S4` schedule gate · `R3-S5` dialogue quartet · `R3-S6` legibility · `R3-S7` persistence · `R3-S8` regression. Doc 03 §3 battery items are cited as "B:3.1.n / B:3.2.n / B:3.3".

**Existing functions the plan relies on (all verified on main):** `canOfferInvitation`, `offerInvitation`, `acceptInvitation`, `declineInvitation`, `expireInvitationsAt/InPlace`, `isInvitationLive/Expired`, `computeOfferWindow`, `isHostAvailableForActivity` (`invitations.ts`); `setOccupant/clearOccupant/isStationOccupied` (`occupancy.ts`); `completeSharedActivity`, `applySharedActivityAffinity` (`activities.ts`); `enterNookAction/exitNookAction/interactWithNookProp/browseBookshelfAction/togglePlayerSitAction` (`actions.ts`); `enterBakeryAction/exitBakeryAction/interactWithBakeryProp/checkMorningBakeAction/helpKneadDoughAction/shareMorningLoafAction/readBakeryNotesAction` (`actions.ts`); `getBakeForDay` (`bakery.ts`); `advanceToNextDay` (`storage.ts`); `stepSimulation/stepSimulationInPlace` (`simulation.ts`); `migrateWorldState/sanitizeWorldState` (`migrations.ts`); `getTimePhase` (`time.ts`).

**Proposed functions the plan calls (doc 05; must exist before these cases execute):** `reconcileInvitedInteriorEntry(world, location)` [invitations.ts]; `offerPhases`/`arrivalLine`/`summaryCompose` def fields; `dialogue/invitations/clara.ts` quartet + aggregator spread; `bakery_cafe_table` interactable branch in `interactWithBakeryProp`; bakery station guards; `App.tsx` `share_morning_pastry` handler; scene occupant parameterization (manual QA only).

**Staging discipline (doc 21 §2.4, binding):** every staged invitation must be **live at creation** — window `[minuteOfDay, …]` anchored at the staged minute, `expiresDay === offeredDay`. No pre-window actives (D-03 tolerant reading is gone; LRTL-01 pins the strict archive).

**Clock arithmetic used throughout:** morning = 360–689; afternoon = 690–959; golden = 960–1109; dusk = 1110–1290 (`time.ts:16-22`). Clara's morning window end = **719** (away-afternoon cap, `computeOfferWindow:141-142`). Default test minute for bakery staging: **495** (8:15 AM, morning).

---

## 1. Invitation lifecycle (R3-S2, R3-S4)

| ID | Scenario | Preconditions | Actions | Expected result | Fail if | Production pathway | Existing coverage | Proposed coverage |
|---|---|---|---|---|---|---|---|---|
| LR3-01 | Clara can offer when eligible | `playerRelations.clara.affinity ≥ 45` (tier friendly+), no active invite, day − lastOfferDay ≥ 2, Clara not guarded, morning (495), no encounter involving Clara | `canOfferInvitation(world,'clara','share_morning_pastry')` → `offerInvitation` | eligible; active record `{hostId:'clara', activityId:'share_morning_pastry', offeredDay===expiresDay, windowStart 495, windowEnd 719}`; `lastOfferDayByHost.clara === day` | any gate refuses; window end ≠ 719; spacing not stamped | `canOfferInvitation`/`offerInvitation` (invitations.ts:159/209) | LR1-01/02/03 (Nora analogs) | `invitations.test.ts` new LR3 block |
| LR3-02 | Offer unavailable outside the offer phase | Same as LR3-01 but minute 975 (golden) and minute 1150 (dusk) | `canOfferInvitation` at each minute | `eligible:false`, reason `offer_phase_closed` [PROPOSED reason]; offer topic absent from dialogue selection (case LR3-25) | golden/dusk offers pass (the verified gate reality: 5.533 m / 0.0 m) | `offerPhases` check (doc 05 §7.2) | none (Nora has no phase field) | `invitations.test.ts`; `dialogue.test.ts` |
| LR3-03 | Offer blocked in the away-afternoon | Minute 700 with no phase field edge | `canOfferInvitation` | `eligible:false`, reason `host_unavailable` (schedule slot 8.938 m > 6.0 m) | offer succeeds | `isHostAvailableForActivity` (:59) | LR1-10 | `invitations.test.ts` |
| LR3-04 | Acceptance records the correct activity | LR3-01 state offered | `acceptInvitation` | status `accepted`; `activityId` unchanged; slot non-terminal; no reward writes (affinity/memories untouched) | accept mutates anything but status | `acceptInvitation` (:255) via actions:897 | LR1-03 | `invitations.test.ts` |
| LR3-05 | Decline produces the correct state | offered invite | `declineInvitation` | active null; history entry `declined` capped; occupancy/`activeActivity` null; zero affinity/memory/teaching writes | any reward; accept-after-decline allowed (LR2-11 semantics) | `declineInvitation` (:284) | LR1-04, LR2-11 | `invitations.test.ts` |
| LR3-06 | Expiration is deterministic | accepted invite, minute 495 | `advanceClockAndReconcile(world, 240)` → 735 | expired exactly once at the first reconciling step past 719/735 boundary semantics; visible generic toast "The invitation with Clara quietly passed for today."; history `expired`; occupancy/`activeActivity` null | double archive; silent expiry; penalty/reward | `expireInvitationsAt` (:319) | LR1-05/06/07, LR1-13 | `invitations.test.ts` |
| LR3-07 | Duplicate invitations prevented | active invite exists (any host) | `offerInvitation` for clara | `eligible:false`, reason `active_invitation_exists` | second slot created | `canOfferInvitation` :165-167 | LR1-02 | `invitations.test.ts` |
| LR3-08 | Invalid acceptance rejected | no invite / expired invite / offered-by-other-host state | `acceptInvitation` | `ok:false` with `no_offered_invitation` or `invitation_expired`; world unchanged | accept succeeds on stale state | `acceptInvitation` :258-263 | LR1-05 | `invitations.test.ts` |
| LR3-09 | Host unavailability at offer (encounter) | Clara in an `activeEncounters` participants list, morning | `canOfferInvitation` | `eligible:false`, reason `host_unavailable` | offer surfaces mid-encounter | `isHostAvailableForActivity` :74-76 | LR1-10 | `invitations.test.ts` |
| LR3-10 | Host unavailability at enter is surfaced, not silent | accepted live invite; Clara placed in an exterior encounter before entering | `enterBakeryAction` | player enters; invite archived with reason `host_unavailable`; **no occupancy**; visible "had to step out" line | phantom occupant; silent archive | enter helper (doc 05 §5.1 step 2-else) | LRTL-05 (nook pin) | `occupancy.test.ts` LR3 block |
| LR3-11 | Window cap equals contiguous home boundary | offer at 400 / 495 / 650 | `offerInvitation` each | windowEnd = min(now+180, 719) = 580 / 675 / 719 | any windowEnd > 719; any end inside the afternoon (≥ 690 while morning-available cap is 689-rule is NOT applied — 719 as-built is the pinned constant, see LR3-19) | `computeOfferWindow` :127-152 | LR1 window pins (Nora) | `invitations.test.ts` parametric |
| LR3-12 | 2-day spacing per host (Clara-specific) | lastOfferDayByHost.clara = today | offer next day | `spacing_cooldown` on day+1; eligible on day+2 | offer on day+1 | `canOfferInvitation` :174-180 | LR1-09/09b | `invitations.test.ts` |

## 2. Arrival and interior tests (R3-S1, R3-S6)

| ID | Scenario | Preconditions | Actions | Expected result | Fail if | Production pathway | Existing coverage | Proposed coverage |
|---|---|---|---|---|---|---|---|---|
| LR3-13 | Enter during a live accepted bakery invite places Clara | accepted live bakery invite (minute 495); Clara available; player exterior at bakery door | `enterBakeryAction` | `playerLocation === 'bakery_interior'`; occupancy triple `{residentId:'clara', location:'bakery_interior', stationId:'bakery_seat_cafe_west', invitationId: active.id}`; `activeActivity` `{activityId, invitationId}` match; arrival toast names Clara (def `arrivalLine`); B:3.1.1 | occupant absent/mismatched; activeActivity missing | enter helper + `setOccupant` | LR2-01 (nook analog) | `occupancy.test.ts` |
| LR3-14 | Enter reconciliation identifies the correct invitation | accepted live invite; all fields consistent | `enterBakeryAction` | helper resolves def by `activeInv.activityId` (not by venue string matching); occupant set from def seat data | venue-name-based resolution; hardcode | doc 05 §5.1 step 2 | LRTL-02 | `occupancy.test.ts` |
| LR3-15 | Unrelated invitations do not trigger the bakery activity | accepted live **Nora** invite (`share_featured_reading`); player enters **bakery** | `enterBakeryAction` | bakery entry succeeds; **no occupant**, `activeActivity` unchanged (null), Nora invite still accepted+live | Clara appears for a Nora invite; Nora invite expired by bakery entry | helper `def.location === location` guard (doc 05 §5.1 step 2) | none (first cross-venue case) | `occupancy.test.ts` |
| LR3-16 | Mirror: nook entry does not honor a Clara invite | accepted live Clara invite; `enterNookAction` | no occupant in nook; invite intact | cross-trigger | helper | new | `occupancy.test.ts` |
| LR3-17 | Incorrect venue entry does not start the activity | accepted live bakery invite; player enters **cottage** | `enterCottageAction` | cottage entry unchanged (no reconcile, no toast); invite untouched | cottage suddenly reconciles (behavior change) | `enterCottageAction` [UNCHANGED] | none | `actions` regression assert (light) |
| LR3-18 | Late arrival inside the 690–719 dead zone | accepted live invite; minute 700 (Clara's afternoon slot is away) | `enterBakeryAction` | invite archived `host_unavailable` with visible line; no occupant; player still inside bakery | occupant placed while Clara's slot is Fountain Plaza; silent clear | doc 05 §7.3 (accepted as-built semantics) | none (nora analog absent — her window has the same shape) | `occupancy.test.ts` explicit dead-zone case |
| LR3-19 | Schedule drift is owned by the enter reducer, not the tick | accepted live invite; tick steps across 690 while player outside | `stepSimulation` steps | tick expires the invite **only** at window end (719+), never at the phase boundary; no occupancy created outdoors (LRTL-04 semantic) | tick creates/clears occupancy; early expiry | `expireInvitationsInPlace` :384 | LRTL-04/05 | `lr-tick-load.test.ts` LR3 analog |
| LR3-20 | Failed entry does not create phantom occupancy (crash-safe sequence) | accepted invite; host unavailable; enter (refused); exit; re-enter | `enterBakeryAction` ×2, `exitBakeryAction` | no occupancy at any point; single `host_unavailable` history entry (idempotent expiry — second enter sees no active invite) | duplicate history rows; occupancy flash | `expireInvitationsAt` idempotency | LRTL-06 | `occupancy.test.ts` |
| LR3-21 | Exit clears the session, re-entry restores it | LR3-13 state (occupant set) | `exitBakeryAction` → `enterBakeryAction` | after exit: occupancy null, `activeActivity` null, invite still accepted+live; after re-enter: occupant restored identically; **single** completion still possible afterward | invite expired by exit; double-place rig; occupancy survives exit | `exitBakeryAction` [ARCH] + helper | nook re-entry semantics | `occupancy.test.ts` |
| LR3-22 | Dawn ejects and archives | occupant set; `advanceToNextDay` | sleep | player exterior at porch exit; invite archived `day_end`; occupancy/`activeActivity` null; B:3.1.5 | woke inside bakery with stale occupancy | `storage.ts:523-636` | LR1-11/11b/12 (nook) | `storage.test.ts` LR3 analog |

## 3. Station exclusivity tests (R3-S3, R3-S6)

Guard condition under test: `isStationOccupied('bakery_interior','bakery_seat_cafe_west') \|\| activeActivity?.activityId === 'share_morning_pastry'` (doc 05 §6.4).

| ID | Scenario | Preconditions | Actions | Expected result | Fail if | Production pathway | Existing coverage | Proposed coverage |
|---|---|---|---|---|---|---|---|---|
| LR3-23 | Clara's reservation claims the station | LR3-13 state | inspect occupancy | `stationId === 'bakery_seat_cafe_west'`; `isStationOccupied(...)` true | claim under a different id | def stationId → `setOccupant` | LR2-01 | `occupancy.test.ts` |
| LR3-24 | Player sit on the claimed chair is refused | LR3-13 state | `togglePlayerSitAction(world, 'bakery_seat_cafe_west')` | `sat:false`; visible refusal line; world unchanged | sit succeeds; silent refusal | sit guard mirror (actions.ts:979-988 pattern) | nook armchair guard test | `player.test.ts` / actions suite |
| LR3-25 | Knead refused during the session, zero mutation | LR3-13 state; snapshot `bakeryState` | `helpKneadDoughAction` | refusal card; `kneadedDay`/`kneadingSessions` byte-identical to snapshot; clock minute unchanged; B:3.2.1 | any bakeryState write; +12m | guard in `helpKneadDoughAction` | none | `activities.test.ts` LR3 block |
| LR3-26 | Loaf-share refused during the session, zero mutation incl. inventory | LR3-13 state; snapshot `bakeryState`+`inventory` | `shareMorningLoafAction` | refusal card; `loafSharedDay`/`loavesShared`/inventory byte-identical; no +6m | item granted; counter moves | guard in `shareMorningLoafAction` | none | `activities.test.ts` |
| LR3-27 | Oven check refused during the session, zero mutation | LR3-13 state; snapshot `bakeryState`, minute | `checkMorningBakeAction` | refusal card; `bakeCheckedDay` unchanged; minute unchanged | bake reveal fires during session | guard in `checkMorningBakeAction` | none | `activities.test.ts` |
| LR3-28 | Notes shelf remains usable during the session (negative guard check) | LR3-13 state | `readBakeryNotesAction` | unchanged current behavior (allowed) | over-guarding blocks the notes shelf | no guard (doc 05 §6.4) | existing bakery suite | `bakery.test.ts` |
| LR3-29 | Knead-first bonus unregressed when the shared activity is NOT used | fresh day; no invite | knead → share solo | share count 2 exactly as today; both counters advance; B:3.2.2 | bonus lost | `shareMorningLoafAction` :2849-2856 | existing bakery knead/share tests | `bakery.test.ts` re-pin |
| LR3-30 | Cancellation cleanup (decline after enter-refused path; expiry path) | occupant state variants: (a) decline a live offered invite while occupant set from earlier accept-cycle is impossible (decline requires offered) — therefore: (b) window expiry while occupant set | `expireInvitationsAt` / tick | occupant cleared with the invite; station claim released; subsequent solo sit/knead work immediately | stale claim; station locked after expiry | `expireInvitations*` clear block :390-411 | LR2-04b | `occupancy.test.ts` |
| LR3-31 | Interruption cleanup (exit mid-session) | LR3-13 state | `exitBakeryAction` | claim released (LR3-21); solo actions usable again on re-entry before re-claim… (if invite still accepted+live, re-enter re-claims — assert the two states precisely) | claim persists while outside | `exitBakeryAction` [ARCH] | nook exit semantics | `occupancy.test.ts` |
| LR3-32 | Completion cleanup | LR3-13 state | complete (LR3-36) | occupancy null; `activeActivity` null; invite archived `completed`; station free for solo sit | claim survives completion | `completeSharedActivity` :326-327 | LR2-05 | `activities.test.ts` |
| LR3-33 | Save/load restores the claim coherently | LR3-13 state saved; reload | round-trip | occupancy restored exactly (all five fields) or cleared with warning + invite archived per load invariant (LR2-15/16 analog); B:3.1.6 | restored occupant without live invite; stationId lost | sanitizer :1540-1577 | LR2-15/16, storage tests | `storage.test.ts` LR3 round-trip |
| LR3-34 | Stale-stationId recovery [GATE-CONDITIONAL] | hand-staged save: occupancy `stationId:'nook_chair'` inside `bakery_interior` with live clara invite | load | Under reliability-gate path (a) or re-derived path (b): cleared + classified warning (SR-7 rule). Under path (c) deferral: current main behavior (kept, non-empty string) — **the plan records the expected outcome for the chosen gate path before implementation** | silent restore of a cross-venue stationId without a warning under (a)/(b) | sanitizer stationId rule (branch `migrations.ts`; main :1555-1556) | branch `save-integrity.test.ts` SR-7 fixtures (path a) | `storage.test.ts` fixture; doc 07 D7 note |

## 4. Activity completion tests (R3-S2, R3-S7)

| ID | Scenario | Preconditions | Actions | Expected result | Fail if | Production pathway | Existing coverage | Proposed coverage |
|---|---|---|---|---|---|---|---|---|
| LR3-35 | Valid completion (full reward set, exactly once) | LR3-13 state | `completeSharedActivity(world,'share_morning_pastry')` (via dialogue choice or station card pathway) | `ok:true`; affinity +6 (0..100 clamp), reliability +2, `favorsCompleted+1`, host emotion warm 90 min; journal memory `mem_lr_clara_morning_pastry` exactly one; host-only NPC memory tag `shared_morning_pastry` exactly one; one `shared_activity` world event; invite archived `completed`; occupancy/`activeActivity` null; B:3.2.5 | any double write; wrong deltas; book title leaking into bakery text | `completeSharedActivity` :161-336 | LR2-05/09/10 | `activities.test.ts` LR3 block |
| LR3-36 | Completion via both trigger surfaces | same state; run twice in separate worlds | (a) dialogue choice `completeSharedActivityId` (actions.ts:213-232); (b) station-card `actionType` handler (App.tsx) | both pathways produce identical world deltas (deep-compare except session UI fields) | divergent writes per surface | doc 14 §5.1 "Dialogue choices and station buttons both call this function" | LR2 analogs | `activities.test.ts` + handler assertion |
| LR3-37 | Invalid completion — wrong activity id | occupant set for bakery; call with `'share_featured_reading'` | `completeSharedActivity` | `ok:false`, `no_matching_accepted_invitation` (activity mismatch), world unchanged | cross-activity completion | :170-172 | LR2-07 family | `activities.test.ts` |
| LR3-38 | Invalid completion — wrong location / no occupant | accepted live invite, player exterior | `completeSharedActivity` | `ok:false` (`wrong_location` then `occupant_not_present` order per :188-195) | completes outdoors | :188-195 | LR2-06 | `activities.test.ts` |
| LR3-39 | Completion after host unavailability (encounter drift) | occupant set; Clara injected into an encounter | `completeSharedActivity` | `ok:false`, reason `host_unavailable`, visible "had to step out" toast; invite + occupancy **untouched** (window-end expiry cleans up); nothing granted; D-04/H-1 | completion succeeds with drifted host; state cleared | :209-216 | H-1 test (LR2) | `activities.test.ts` |
| LR3-40 | Completion after interruption | occupant state → exit → re-enter → complete | `completeSharedActivity` | succeeds exactly once (re-entry restored the triple) | completion refuses after restore | helper idempotency | LR3-21 chain | `activities.test.ts` |
| LR3-41 | Duplicate completion attempts | completed state | `completeSharedActivity` again | `ok:false`, `already_completed`; world byte-identical; second history row NOT added | second memory/reward; B:3.2.4 | :219-221 | LR2-07/07b | `activities.test.ts` |
| LR3-42 | Pre-seeded memory id blocks completion | accepted+occupant state; `world.memories` pre-seeded with `mem_lr_clara_morning_pastry` | `completeSharedActivity` | `ok:false`, `already_completed` (LR2-07b analog); no writes | overwrite/second memory | :219-221 | LR2-07b | `activities.test.ts` |
| LR3-43 | Rewards applied exactly once across save/load | complete → save → load → inspect | round-trip | affinity/reliability/memory/world-event/history all singular after reload | duplicated on load | sanitizer + idempotent ids | LR1-13/14 | `storage.test.ts` |
| LR3-44 | Relationship consequences land through the generic pipeline | LR3-35 result | inspect `playerRelations.clara`, `residents.clara.trust` | +6 affinity outside `dailyAffinityGained` (cap untouched, value unchanged); trust hearts derived (:124); mood warm; tier thresholds respected | smalltalk cap consumed; dailyAffinityGained incremented | `applySharedActivityAffinity` :87-146 | LR2-09/10 | `relationships`/`activities` tests |
| LR3-45 | Journal representation | LR3-35 result | inspect journal view + `world.memories` | one memory: id/day/phase/title "First Crackles at the Café Corner"; summary names the **day's bake** and **Hearth & Crumb** (never a book title, never Linden Book Nook); journal "Today's Invitation" card during a live invite shows `Shared Morning Pastry / Hearth & Crumb Bakery / window clock` (registry-generic card :1169-1186); B:3.2.7 legibility row | nook text leak (F1 regression); wrong venue label | `summaryCompose` + journal card | journal tests | `journal.test.ts` LR3 text pins |
| LR3-46 | World event summary is venue-true | LR3-35 result | inspect `worldEvents` tail | exactly one `shared_activity` event; summary references Clara + Hearth & Crumb; `summaryTag: 'shared_morning_pastry'` | book/venue leak | `summaryCompose` event text | worldEvent pins | `activities.test.ts` |
| LR3-47 | Host-only memory boundary (no gossip write) | LR3-35 result | inspect `npcMemories` other residents; run gossip propagation | only Clara holds the memory; no other resident gains it directly (LR2-13 analog); gossip pipeline untouched | leaked writes | `recordNpcMemoryInPlace` host-only :247-270 | LR2-13 | `memories.test.ts` |
| LR3-48 | Teaching stays empty (doc-10 trap guard) | complete LR3-35; run all LR3 pathways in a fixture world | inspect `teaching.known` | empty after every pathway; def has no `knowledgeGranted` | any knowledge write; B:3.2.8 | def omission + `requiresTeachingKnown` topics absent | teaching assertions in recovery suite | `activities.test.ts` explicit |

## 5. Dialogue tests (R3-S5, R3-S6)

| ID | Scenario | Preconditions | Actions | Expected result | Fail if | Existing coverage | Proposed coverage |
|---|---|---|---|---|---|---|---|
| LR3-49 | Offer topic surfaces when eligible (NR-01 analog) | eligibility true (morning) | two ordinary dialogue selections with Clara | offer topic appears within two interactions; choices carry `offerInvitation` + accept/decline flags wired to the writers | topic never surfaces; writer flags absent | NR-01 (lr-tick-load) | `dialogue.test.ts` |
| LR3-50 | Offer topic silent when ineligible | each gate individually broken (spacing/guarded/tier/afternoon/golden+offerPhases) | dialogue selection scan | `inv_clara_offer_pastry` absent in all five; no stale text claims availability | topic appears under any broken gate | condition evaluator :473-479 | `dialogue.test.ts` matrix |
| LR3-51 | Pending re-ask topic | offered live invite; player reopens dialogue | select | re-ask node; accept/decline choices; decline archives per LR3-05 | accept writes rewards | nora analog | `dialogue.test.ts` |
| LR3-52 | Arrival/indoor completion topic | occupant set (LR3-13) | dialogue with Clara indoors | indoor topic (requiresActiveInvitation accepted+live+requireIndoors); completion choice present; "look around first" branch completes nothing | completion offered outdoors; requireIndoors bypassed | dialogueEngine :480-501 | `dialogue.test.ts` |
| LR3-53 | Reminder topic (accepted, outdoors) | accepted live invite; player exterior with Clara | select | reminder node with no completion choice | indoor completion reachable outdoors | nora analog | `dialogue.test.ts` |
| LR3-54 | No stale dialogue after cancellation | declined / expired / completed states | dialogue scan | no invitation-quartet topic surfaces for the dead invite; Clara's everyday topics unaffected | ghost offer/pending topic | excludesActiveInvitation + conditions :503-505 | `dialogue.test.ts` |
| LR3-55 | No false claims about events or memories | completed state; Clara dialogue sweep | select everyday topics | no topic claims the pastry sharing before it happened; after completion, memory-referencing lines (existing retrieval) only reference the actual memory id | anticipatory or fabricated claims | memory retrieval :816-1047 | `dialogue.test.ts` sweep |
| LR3-56 | Golden snapshot regenerated with justification | quartet added + aggregator spread | regenerate snapshot; run `dialogueRegistry.test.ts` | count 85 → 89 (4 Clara topics), fixed order preserved; **written behavioral justification** committed alongside (HANDOVER §17 convention) | silent count/order drift; unjustified regen | golden test :44-93 | updated snapshot + rationale file note |

## 6. Cross-venue regression (R3-S8 — mandatory, interleaved)

| ID | Scenario | Sequence | Expected result | Fail if |
|---|---|---|---|---|
| LR3-57 | Complete Nora, then Clara (same day) | morning Clara offer+accept+enter+complete → afternoon/golden Nora offer (spacing is per-host; both fit day 1: Clara morning cap 719, Nora offer later) → nook enter+complete | both completions independent; both histories singular; each venue's counters/def rewards correct; second offer allowed after first completes (slot freed) | slot leak; cross-venue counters; second offer refused while no invite active |
| LR3-58 | Accept bakery invite → enter the **nook** | accepted Clara invite; `enterNookAction` | no nook occupant; Clara invite intact (LR3-16); then `enterBakeryAction` completes normally | cross-venue placement |
| LR3-59 | Save during a bakery session; load into a fresh process; finish there | save mid-occupancy → load → complete | LR3-33 + LR3-35 all hold post-load | phantom occupant; duplicate rewards |
| LR3-60 | Cancel one activity while the other venue stays available | Clara invite live → window expires (tick) → Nora offer same day | expiry affects only Clara; Nora eligibility unaffected (spacing is per-host) | cross-host spacing/cooldown bleed |
| LR3-61 | Host unavailability in one venue | Nora encounter-staged at nook enter; Clara unaffected | only the nook enter refuses; bakery path independently healthy | global refusal |
| LR3-62 | Both venues across schedule boundaries | Clara morning (495) full cycle; +2h steps into afternoon; Nora offer at 990 (golden — her porch slot 0.28 m is inside radius); full cycle | each venue honors its own window/phase semantics (Clara morning-only via D2; Nora unchanged incl. golden) | Clara golden offer (gate break); Nora golden refusal (regression) |
| LR3-63 | Repeatedly enter/leave both interiors (10 alternations) | enter/exit bakery ↔ nook ×5 each with live invite only on one side at a time | occupancy belongs to exactly one venue at any step; final state clean; no rig ghosting (manual QA note for scene) | orphan occupancy; double rig |
| LR3-64 | Conflicting activity transitions | attempt: complete nook while bakery occupant set; complete bakery while nook occupant set; accept while accepted; offer while offered | every invalid transition rejected with the specific reason; worlds byte-identical on rejection | silent cross-clear (rejected in adversarial review — occupancy unit-clear stays rejected) |

## 7. Determinism and persistence (R3-S7)

| ID | Scenario | Expected | Existing | Proposed |
|---|---|---|---|---|
| LR3-65 | Identical seed + initial state → identical results | run the LR3-57 sequence twice from the same seed: offers, windows, expiries, completions, worldEvents ids (day/minute derived) byte-identical | simulation determinism tests | `activities.test.ts` replay case |
| LR3-66 | Save/load **before** arrival (accepted, exterior) | invite restored live; no occupancy; later enter honors it | LR1-14 | `storage.test.ts` |
| LR3-67 | Save/load **during** accepted-but-not-entered and mid-session states | LR3-33; `activeActivity` survives only with coherent occupancy | LR2-15/16 | `storage.test.ts` |
| LR3-68 | Save/load **after** completion | archived history restored; no re-grant on any subsequent pathway (LR3-43) | LR1-13 | `storage.test.ts` |
| LR3-69 | Repeated round trips never duplicate rewards | 3× save→load cycles post-completion | storage suite | `storage.test.ts` |
| LR3-70 | Journal + relationship consistency after reload | memories/relations/worldEvents coherent; caps respected (history 12) | journal tests | `storage.test.ts` |
| LR3-71 | No invalid occupancy survives reload | sanitizer matrix: occupancy without live invite / wrong host / wrong location / wrong invitationId → cleared + warning each | LRTL-06 | `storage.test.ts` fixture matrix |
| LR3-72 | Tick/load parity for a bakery invite | expiry minute identical via `stepSimulation` vs save/load path (LRTL analog, second host) | LRTL-01/03/07 | `lr-tick-load.test.ts` LR3 analog |
| LR3-73 | Schema policy, not hardcoded version | gates use `CURRENT_SCHEMA_VERSION` accessor / sanitizer outcome, not the literal 11 | storage harness convention | review checklist item |

## 8. Negative and adversarial cases (every invalid state has an explicit expected outcome)

| ID | Malformed input | Expected outcome (owner) |
|---|---|---|
| LR3-74 | Active invite with unknown `activityId` | sanitizer clears + warning `corrupted active invitation cleared` (:1446-1447) |
| LR3-75 | Active invite host/activity mismatch (clara ↔ share_featured_reading) | cleared + warning (:1434 host-def check) |
| LR3-76 | Occupancy with `residentId` ≠ active host | cleared + warning `inconsistent interior occupancy` (:1552-1553) |
| LR3-77 | Occupancy in `bakery_interior` while `playerLocation === 'exterior'` | cleared (:1546) |
| LR3-78 | `activeActivity` without matching live invite | nulled (:1523-1538) |
| LR3-79 | Window `start > end` / negative / non-finite | cleared as corrupted (:1433 + field guards) |
| LR3-80 | Duplicate completion events replayed from a hand-merged save | `already_completed` strict no-op (transaction guard) |
| LR3-81 | Occupant set with stale/foreign stationId | LR3-34 (gate-conditional per chosen path) |
| LR3-82 | Missing host (hostId absent from RESIDENTS) | sanitizer `validHosts` drop (:1390, :1400) → cleared |
| LR3-83 | Missing venue (def removed/renamed while a save holds its invite) | activityId fails `SHARED_ACTIVITIES` lookup → cleared (:1403-1406); occupancy coherence then clears |
| LR3-84 | Completion invoked with occupant from the *other* venue | `occupant_not_present` (location/host triple mismatch :193) |
| LR3-85 | Enter with held prop + live invite (state interplay) | prop placed first (existing held-prop branch :2669-2671), then reconcile — order pinned so no prop-in-hand occupancy races |
| LR3-86 | `offerPhases` absent (Nora def) + minute in golden | unchanged eligibility (field-absence pass; doc 14 §8 optional-field rule) |

## 9. Required test categories mapping (doc 03 §3.4)

A relationship (LR3-44) · B NPC autonomy (LR3-09/10/19) · C social knowledge (LR3-47) · D dialogue accuracy (LR3-49–56) · E activity lifecycle (LR3-01–12, 35–42) · F persistence (LR3-33, 66–71) · G determinism (LR3-65, 72) · H long-run (LR3-57/60/63 across days; history cap rollover via repeated invites) · I regression (LR3-29, 56, 57–64, full suite).

## 10. Definition of done for the acceptance battery

1. Every LR3-xx above is executed and green (or N/A with written justification approved in review).
2. The entire pre-existing suite (447 + reliability's 459 when merged) remains green, unmodified except the golden snapshot regeneration with justification.
3. `tsc --noEmit` clean; production build green.
4. Tick/load parity, purity test, and sanitizer warning-parity pins all green.
5. Manual scene QA: occupant rig visible/seated at the café corner, click-routing labels truthful, no stuck states after enter/exit ×10 (LR3-63), cross-venue interleaving visually correct.
