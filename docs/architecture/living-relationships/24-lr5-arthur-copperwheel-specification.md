# 24 — LR-5 Arthur / Copperwheel Hosting Specification (implementation-ready)

- **Date**: 2026-11-22
- **Status**: READY-WITH-EXPLICIT-DECISIONS — implementation-ready pending the decision register §5; no feature code written (deliberate).
- **Definition of record**: `14-revised-architecture.md` §10 LR-5 row: *"Arthur / Copperwheel only after Build 9 has merged"* (`:297`); Build 9 (Copperwheel Cottage, WorldState v10) IS merged; LR-5 additionally inherits LR-3's shipped patterns (enter helper, offerPhases, venue-true toasts) per its dependency row.
- **Preparation audit**: `docs/architecture/social-foundation/01-audit-synthesis.md` §5; LR-3 contract inheritance `03-lr3-scope-and-acceptance.md` §4.

---

## 1. As-built source seams (verified @ `a80a220`)

| Seam | Fact |
|---|---|
| `copperwheel.ts:27-61` | Bounds (±3.0 x, ±2.5 z) + obstacles (`cw_bench`, `cw_bed`, `cw_shelf`, `cw_stove`, `cw_chair`); walkability + waypoints complete. |
| `copperwheel.ts:74-125` | Interactables: `cw_bench` "Check the Workbench" (x −1.5, z −1.0, radius 1.9), kettle/ledger/nightstand stations. |
| `copperwheel.ts:144-210` | 4-day project rotation (`getProjectForDay`), ritual minutes (bench +10m, tea +6m, notes +8m, nightstand +4m). |
| `copperwheel.ts:350-362` | Exactly ONE seat spot: `cw_seat_armchair` (player seat) — **no occupant anchor exists** (contrast `occupancy.ts:19-23` nook constants). LR-5 must ADD bench occupant constants (station id + `seatPos` + `seatFacing` + approach pos). |
| `actions.ts:3287-3311 / 3313-3330` | `enterCopperwheelAction` / `exitCopperwheelAction` — **no invitation reconcile / occupancy graft today** (the exact asymmetry LR-3's F-ENTER-1 helper resolves; LR-5 adopts the helper, it does not fork it). |
| `actions.ts:3367-3424` | `checkWorkbenchProjectAction` — the solo bench ritual; station-exclusivity surfaces that the shared activity must NOT mutate (doc 14 §6.1: counters untouched). |
| `dialogue/interiors/copperwheel.ts:23-159` | Arthur's two existing topics (`side_arthur_workshop_bench`, `daily_arthur_workshop_checkin`). No invitation topics yet. |
| `residents.ts:89-148` | Arthur: `homePos {8.8,-7.6}`, homeName Copperwheel Cottage, sociability 0.2 (lowest), schedule — morning yard 0.22 m; afternoon East Bench 11.6 m (auto-blocked); golden Gazebo Steps 5.69 m (**passes** the 6 m gate!); dusk porch 0.0 m. Post-reconcile override slot ≈8.6 m would FAIL the raw-schedule reader (`invitations.ts:67` reads `RESIDENTS[id].schedule[phase]` directly, not `getResidentScheduleSlot`). |
| `activities.ts:52-72` | Registry shape of record (the nook def) — LR-5 appends `share_workbench_hour`. |
| SF-1..SF-4 | Capability rows, ledger labels, cancellation, coherence probes, emergent seeds (bridging/tradition/feeling) all pick Arthur up **automatically** once the def exists (doc 22 §8). |

## 2. Scope

### 2.1 In scope

| ID | Item |
|---|---|
| L5-S1 | `share_workbench_hour` def (host arthur, location `copperwheel_interior`, station id + occupant seat constants, `minTier`/`minAffinity` per D-5A, `minutesSpent`, affinity/reliability deltas per chassis defaults 6/2, `memoryId 'mem_lr_arthur_workbench_hour'`, `npcMemoryTag 'shared_workbench_hour'`, `knowledgeGranted 'arthur_escapement_basics'` — requires LR-4's grant mechanics to have landed). |
| L5-S2 | Occupant anchor: `CW_BENCH_STATION_ID` / `CW_OCCUPANT_POS` / `CW_OCCUPANT_FACING` / approach constants (mirroring the nook pattern; walkability + clearance evidence required). |
| L5-S3 | Enter/exit graft: adopt LR-3's `reconcileInvitedInteriorEntry` helper in `enterCopperwheelAction` + location-guarded occupancy clear in `exitCopperwheelAction`. |
| L5-S4 | Venue-true surfaces (D9/D6 as shipped by LR-3): completion summary via the def-level `summaryCompose` (Arthur's strings), accept toast via `RESIDENTS[host].homeName`, station guard + sit refusal line when the bench is claimed (D3 precedent). |
| L5-S5 | Arthur invitation quartet: `dialogue/invitations/arthur.ts` (in-room completion / pending / fresh offer / reminder — nora.ts pattern) + aggregator spread + golden regen (tail-append). |
| L5-S6 | Scene: parameterized occupant rig per LR-3's D8 outcome (never a second hardcode). |
| L5-S7 | Acceptance battery §6 (red-test-first). |

### 2.2 Out of scope

- Full tool-crafting (doc 10 exclusion stands), Barnaby/Sora/Toby hosting (later breadth pass), second occupant slot, multi-NPC interior pathfinding, any reconciliation-override availability gate beyond D-5B's decision.

## 3. Contract inheritance (binding, from docs 03 §4 / 14 / 20 / 21 / 22)

Strict predicate duality; anchored windows computed from Arthur's contiguous home availability (never copied constants — D-17); occupancy written only inside the enter reducer via the helper; completion-time host-encounter re-check (H-1); no sanitizer ceilings; golden regen only with justification; tick path allocation-free; SF band rules apply to any new topics (protected categories stay boost-free); `requiresWitnessedEvent` for any new witnessed-event reaction; knowledge grant through LR-4's `completeSharedActivity` mechanics only.

## 4. Verified schedule facts (drive the tests)

- Morning offer (yard, 0.22 m): eligible; window capped by the afternoon away-slot rule.
- Afternoon (East Bench, 11.6 m): `host_unavailable` — auto-blocked.
- Golden (Gazebo Steps, 5.69 m): passes the generic 6 m gate — a workbench-hour offer at golden would host Arthur AWAY from the bench. This is D-5B's subject (offerPhases decision).
- Dusk (porch, 0.0 m): eligible.
- Post-reconciliation override slot (gazebo, ≈8.6 m): fails the raw-schedule reader — D-5C must decide whether availability consults `getResidentScheduleSlot` (override-aware) or stays raw.

## 5. Design decisions to settle before code

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D-5A | Offer gating for `share_workbench_hour` | tier/affinity floors only vs designed story gate (candidate: `copperwheelVisited` sideFlag — his own workshop already introduces him; or `claraArthurReconciled` for the quiet post-rift reading) | **`copperwheelVisited`** — discoverability rides his own authored arc (Nora-postcard precedent) |
| D-5B | Offer phases | (a) adopt LR-3's shipped `offerPhases` def field (morning/dusk only for Arthur) — requires LR-3 landed; (b) pre-gate via eligibility reason extension | **(a)**; golden slot (5.69 m) must NOT offer a bench visit while Arthur is on the Gazebo Steps |
| D-5C | Availability reader | raw `RESIDENTS[id].schedule` vs override-aware `getResidentScheduleSlot` | Keep raw for the offer gate (chassis contract; reconciled golden override is a *reconciliation* state, not a hosting state) and pin the behavior in a test |
| D-5D | Occupant anchor station | reuse existing `cw_bench` interactable vs a new station interactable | Reuse `cw_bench` as the station anchor + a dedicated occupant stand/seat spot beside it; solo-bench ritual gets the same suppression treatment as the nook shelf (LR2-06 pattern) |
| D-5E | Arthur discoverability vs sociability | tier floors vs sociability-aware pacing | Tier floors only (no new mechanics; sociability already shapes encounters, not invitations) |

## 6. Acceptance test plan (red-test-first)

Inherit the full LR-2 battery re-parameterized for copperwheel (doc 22 §8 + doc 16 §5) plus:

| ID | Scenario | Expected |
|---|---|---|
| LR5-01..07 | Occupancy: enter-with-live-invite places Arthur; distant-slot enter expires; counters untouched; station/sit refusals; day-advance clear; mid-visit reload invariant; host-only memory | Mirrors §3.1 of LR-3 doc 03 |
| LR5-08 | Schedule matrix | morning eligible / afternoon auto-blocked / golden per D-5B / dusk eligible / reconciled-override per D-5C |
| LR5-09 | Completion | `+6/+2` outside smalltalk cap; `mem_lr_arthur_workbench_hour` journal memory; host-only npc memory; knowledge `arthur_escapement_basics` granted exactly once (LR-4 mechanics); venue-true summaries |
| LR5-10 | Workbench solo rituals | `benchCheckedDay`/`projectsAdmired`/`windingSessions` byte-identical across shared-completion paths |
| LR5-11 | Dialogue | quartet surfaces within two ordinary interactions once eligible; golden tail-append justified; `requiresWitnessedEvent` used for any witnessed reactions |
| LR5-12 | Persistence | round-trip incl. mid-visit; sanitizer occupancy restore on copperwheel; tick/load parity |
| LR5-13 | SF integration | capability row + ledger labels + cancellation + chapter/tradition seeds all present for Arthur (automatic — asserted, not re-implemented) |
| LR5-14 | Regression | full suite green; Copperwheel contract tests green; LR-1/2 batteries green |

## 7. Prerequisites & sequencing

1. **LR-4 landed** (grant mechanics + registry) — `knowledgeGranted` must work before the def ships.
2. **LR-3 landed** (or its helper/D6/D9 outcomes consciously re-derived with attribution, per the LR-3 execution strategy) — the enter helper, `offerPhases`, venue-true toasts and rig parameterization are LR-3-owned architecture.
3. Copperwheel interior contract (Build 9) — satisfied on main.
4. Golden-snapshot tail coordination with LR-3/LR-4 topic additions (append order is contractual).
