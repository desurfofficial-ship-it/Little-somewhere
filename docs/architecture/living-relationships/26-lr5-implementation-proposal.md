# LR-5 Implementation Proposal, Reconciliation & Ownership Matrix — Arthur · Copperwheel Workshop (`arthur_escapement_basics`)

> **Status:** Approved Execution Design (Phases 6–10 completed prior to code writes)
> **Authoritative Spec:** [`24-lr5-arthur-copperwheel-specification.md`](./24-lr5-arthur-copperwheel-specification.md)
> **Predecessors:** LR-1/LR-2 (Nora · Book Nook), LR-3 (Clara · Bakery), LR-4 (`teaching` v13 · `nora_featured_reading`), Social Foundation (SF-1..4)

---

## 1. Baseline Verification Snapshot (Clean Post-LR-4 Tree)

Verified cleanly prior to any LR-5 file mutation:
- `npm test`: **1061 / 1061 passing**, 0 failures.
- `npm run lint` (`tsc --noEmit`): exit `0`.
- `npm run build`: exit `0` (`dist/` compiled).
- `npx --yes tsx scripts/check_layer_boundaries.ts`: exit `0` (existing `W5` warning on `journal.ts` unchanged).
- `npx --yes tsx scripts/longrun_stress.ts --quick`: exit `0` (0 hard violations).
- **Environment Constraints**: `.git/` metadata and `gh` CLI are absent in this container; subagent spawning is unavailable, so Streams A–F audits and Adversarial Reviews 1–6 execute sequentially under a single engineer. Git branch/worktree/PR/remote-CI actions are recorded honestly as **Blocked**.

---

## 2. Sequential Audit Synthesis (Streams A–F) & Section 6 Reconciliations

| ID | Audit Finding / Potential Trap | Reconciled Decision | Target Owner |
|----|-------------------------------|---------------------|--------------|
| **A (Architecture)** | `reconcileInvitedInteriorEntry(working, location)` already exists (`invitations.ts:487`) and matches `hostId`, `location`, availability, and `window`; `exitCopperwheelAction` lacked `clearOccupant` & `activeActivity: null`. | Graft `reconcileInvitedInteriorEntry(working, 'copperwheel_interior')` into `enterCopperwheelAction` and `clearOccupant(world, 'copperwheel_interior')` + `activeActivity: null` into `exitCopperwheelAction`. | `src/game/actions.ts` |
| **B (Spatial / Pose)** | `NeighborhoodCanvas.tsx:2543` previously forced `occSeatY = computeSitGroundY(...)` and `'sit'` with `seatedReading: true` for every `occupantRigs` entry. Copperwheel has NO chair by `cw_bench`; forcing `'sit'` would make Arthur float in mid-air. `cw_bench` obstacle covers `x:[-2.92,-0.25], z:[-2.42,-1.52]`; `cw_shelf` covers `x:[-2.96,-2.18], z:[-0.85,1.4]`. | Parameterize `occupantRigs` in `NeighborhoodCanvas.tsx` with pose mode (`'work'` standing at `y = 0`, `seatedReading: false` for `copperwheel_interior` vs `'sit'` at `computeSitGroundY` for Nook/Bakery). Place `CW_OCCUPANT_POS = { x: -1.92, z: -1.18 }` (`0.34m` clear south of bench, clear north/east of shelf), `CW_OCCUPANT_FACING = Math.atan2(-1.35 - -1.92, -1.95 - -1.18) ≈ 2.504` rad toward bench project, `CW_OCCUPANT_APPROACH_POS = { x: -1.05, z: -0.95 }` (strictly walkable with `r = 0.42`, `0.90m` from Arthur, within both `2.45m`/`2.6m` occupant reach and `1.9m` `cw_bench` radius). | `src/game/copperwheel.ts`, `src/game/walkability.ts`, `src/scene/NeighborhoodCanvas.tsx` |
| **C (Schedule / `offerPhases`)** | `RESIDENTS.arthur.homePos = { x: 8.8, z: -7.6 }`. Distance checks: `morning` `0.22m <= 6.0`, `afternoon` `11.58m > 6.0`, `golden` (Gazebo Steps) `5.69m <= 6.0`, `dusk` `0.0m <= 6.0`. Without `offerPhases`, Golden Hour would falsely open invitations even though Arthur is staring at the Gazebo from afar (`D-5B`). `INVITATION_REASON_LABELS.offer_phase_closed` also read *"only happens in the morning"* (`invitationFramework.ts:74`). | Register `offerPhases: ['morning', 'dusk']` (`D-5B`) so afternoon & golden cleanly return `offer_phase_closed` before availability runs; refine `offer_phase_closed` label to *"That plan belongs to another part of the day — catch them at the right hour."* (covers morning-only Clara and morning/dusk Arthur; `SF2-01` continues passing). | `src/game/activities.ts`, `src/game/invitationFramework.ts` |
| **D (Story Gate `D-5A`)** | Doc 24 §2.2 proposed `flagsTrue: ['copperwheelVisited']`, whereas `copperwheelVisited` lives in `world.sideFlags` (`src/game/dialogue/interiors/copperwheel.ts:28, 50, 72`), matching Nora's `sideFlagsTrue: ['nookVisited']`. | Use **`sideFlagsTrue: ['copperwheelVisited']`** on `inv_arthur_offer_workbench` (`D-5A`). Prior to visiting/unlocking Copperwheel (`side_arthur_workshop_bench`, priority 16 -> 92), invitation stays locked; once unlocked, `inv_arthur_offer_workbench` (`86 + 8 = 94`) leads outdoors during morning/dusk. | `src/game/dialogue/invitations/arthur.ts` |
| **E (Station Exclusivity & `bench_rest`)** | `D-5D` reuses `CW_BENCH_STATION_ID = 'cw_bench'` (`COPPERWHEEL_SEAT_SPOTS` stays length `1`: `cw_seat_armchair`). Day 4 (`day % 4 === 0`) sets `getProjectForDay(day).id === 'bench_rest'`. `cw_bench` PropCard during an accepted session delegates to `share_workbench_hour`, while `checkWorkbenchProjectAction` & `togglePlayerSitAction('cw_seat_armchair')` must guard cleanly so solo counters (`benchCheckedDay`, `helpedDay`, `windingSessions`, `projectsAdmired`) are never co-mutated. | Add `isCopperwheelSessionClaimingStation` guard on `checkWorkbenchProjectAction`, add `cw_bench` session branch in `interactWithCopperwheelProp` (with graceful `bench_rest` handling), add `cw_seat_armchair` sit-refusal in `togglePlayerSitAction` while `CW_BENCH_STATION_ID` is occupied, add occupant candidate to `selectBestCopperwheelTarget`, and ensure `summaryCompose` handles `bench_rest` vs working project truthfully. Solo `pourKettleCupAction`, `readMendingLedgerAction`, and `peekNightstandAction` remain usable (matching Bakery notes/Nook desk negative guard discipline). | `src/game/copperwheel.ts`, `src/game/actions.ts`, `src/game/activities.ts`, `src/App.tsx` |
| **F (Teaching & Golden Snapshot)** | `KNOWN_KNOWLEDGE_IDS` in `activities.ts:167` derives dynamically from `SHARED_ACTIVITIES`. Adding `knowledgeGranted: 'arthur_escapement_basics'` increases `KNOWLEDGE_IDS.size` from `1` to `2` (`lr4-teaching.test.ts:83–84` explicitly asserted `false`/`1` while LR-5 was out of scope). Adding 4 Arthur invitation topics + 1 Arthur teaching topic (`teaching_arthur_escapement_basics`, `event_reaction` priority 20, score `88 > 87` echo, singular `requiresNpcMemory.tag = 'shared_workbench_hour'`) raises golden topic count `96 -> 101` and shifts tail-pin assertions in 4 existing test files (`community-dialogue.test.ts`, `dialogueContext.test.ts`, `lr4-teaching.test.ts`, `stage3-baseline.test.ts`). | Append `ARTHUR_INVITATION_TOPICS` inside `dialogue/invitations/index.ts`, append `teaching_arthur_escapement_basics` at end of `TEACHING_TOPICS` in `dialogue/everyday/teaching.ts`, regenerate `scripts/dialogue-topics-golden.json`, document expansion in `scripts/dialogue-topics-golden-justification.md`, and update only the exact tail-pin / LR-5-pre-implementation assertions in those 4 test files without altering any LR-3 or LR-4 behavioral checks. | `src/game/dialogue/invitations/*`, `src/game/dialogue/everyday/teaching.ts`, `scripts/*`, 4 golden-tail tests |
| **G (Schema & Persistence)** | `migrations.ts:2008` checks `occ.stationId === SHARED_ACTIVITIES[active.activityId].stationId` and `migrations.ts:2072` validates `teaching.known` against `KNOWLEDGE_IDS`. | **Zero schema bump** (`WorldState` stays `v13`). Both save/load invariants automatically cover `'arthur'`, `'copperwheel_interior'`, `'cw_bench'`, `'share_workbench_hour'`, and `'arthur_escapement_basics'`. | `src/game/migrations.ts` (verified, unchanged) |

---

## 3. Formal 11-Field Implementation Proposal

1. **Feature / Milestone Title**: LR-5 — Arthur · Copperwheel Workshop Shared Workbench Hour & `arthur_escapement_basics` Teaching Milestone.
2. **Product Pillar Alignment**: Pillar 1 (Living Neighborhood — scheduled workshop availability), Pillar 3 (Personalities — Arthur's quiet perfectionist voice), Pillar 4 (Neighborhood Remembers — journal memory, firsthand `npcMemories`, non-gossip `worldEvent`, `arthur_escapement_basics` reflection), Pillar 6 (Zero grind/skill-tree UI/real-time timers).
3. **Scope (In / Out)**:
   - *In*: `L5-S1`..`L5-S7` as enumerated in `24-lr5-arthur-copperwheel-specification.md`.
   - *Out*: Tool crafting, Barnaby/Sora/Toby hosting, schema version bump (`v13` preserved), edits to LR-3 (`share_morning_pastry`) or LR-4 (`share_featured_reading`).
4. **Canonical Owners & Single Sources of Truth**:
   - Spatial/station constants & selector: `src/game/copperwheel.ts` (`CW_BENCH_STATION_ID`, `CW_OCCUPANT_POS`, `CW_OCCUPANT_APPROACH_POS`, `CW_OCCUPANT_FACING`, `selectBestCopperwheelTarget`).
   - Activity registry & single completion transaction: `src/game/activities.ts` (`SHARED_ACTIVITIES.share_workbench_hour`, `completeSharedActivity`).
   - Walk destination helper: `src/game/walkability.ts` (`occupantApproachPos`).
   - Enter/exit/station/sit reducers: `src/game/actions.ts`.
   - Dialogue topics: `src/game/dialogue/invitations/arthur.ts`, `src/game/dialogue/everyday/teaching.ts`.
   - 3D rig & raycast: `src/scene/NeighborhoodCanvas.tsx`.
5. **Reconciled Design Decisions**: `D-5A`..`D-5E` summarized above (strict `sideFlagsTrue: ['copperwheelVisited']`, `offerPhases: ['morning', 'dusk']`, raw schedule reader unchanged, `cw_bench` reuse, standing `'work'` pose at `y = 0`).
6. **Data & Persistence Impact**: `WorldState` remains `v13`; `teaching.known` accepts `'arthur_escapement_basics'` dynamically via `KNOWLEDGE_IDS`; `occupancy` triple uses `location: 'copperwheel_interior'`, `stationId: 'cw_bench'`.
7. **Layer Boundaries & Rendering Rules**: Zero `three`/DOM/React imports in `src/game/`; zero per-frame allocations inside `NeighborhoodCanvas.tsx` `tick()`; shared palette materials; full `isSoftwareGl` compatibility.
8. **Cross-System / Regression Protections**: LR-3 (`clara`, `bakery_interior`) and LR-4 (`nora`, `nook_interior`, `nora_featured_reading`) preserved byte-for-byte in runtime behavior. Only golden tail-pin and pre-LR5 count guards updated cleanly.
9. **Test Strategy**: Red-first/comprehensive acceptance suite `src/game/lr5-arthur.test.ts` (`LR5-01..LR5-14` + golden/scene/adversarial probes), extended `src/scene/copperwheelInterior.test.ts`, full `npm test`, `npm run lint`, `check_layer_boundaries.ts`, `longrun_stress.ts --quick`, `compile_applet` + `lint_applet`.
10. **Runtime Visual Verification Plan**: Headless Chromium via `playwright-cli` on `http://localhost:3000` at Desktop (`1440×900`) and Mobile (`390×844`) inspecting Arthur's workshop placement (`y = 0`, `'work'` pose, lookYaw, workbench clearance), dialogue completion, localStorage persistence after reload, and 0 console/page errors.
11. **Documentation & Sync Targets**: `WORKLOG.md`, `HANDOVER.md`, `scripts/dialogue-topics-golden-justification.md`, `docs/architecture/living-relationships/24-lr5-arthur-copperwheel-specification.md`.

---

## 4. Ownership Matrix

| Track | Module(s) | Exact Responsibility | Non-Overlap Guarantee |
|-------|-----------|----------------------|-----------------------|
| **LR5-Spatial** | `src/game/copperwheel.ts`, `src/game/walkability.ts` | Station/occupant constants, `selectBestCopperwheelTarget` occupant candidate, `occupantApproachPos('copperwheel_interior')` | Owns Copperwheel local coordinates only |
| **LR5-Engine** | `src/game/activities.ts`, `src/game/invitationFramework.ts` | `share_workbench_hour` registration, `offer_phase_closed` copy generalization | Zero `copperwheelState` writes inside `completeSharedActivity` |
| **LR5-Reducers** | `src/game/actions.ts`, `src/App.tsx` | `enterCopperwheelAction` reconciliation, `exitCopperwheelAction` cleanup, `cw_bench` PropCard + `checkWorkbenchProjectAction` / `cw_seat_armchair` guards, `App.tsx` dispatch | Reuses shared `reconcileInvitedInteriorEntry` & `completeSharedActivity` |
| **LR5-Dialogue** | `src/game/dialogue/invitations/arthur.ts`, `invitations/index.ts`, `everyday/teaching.ts`, `scripts/*` | Arthur invitation quartet (`D-5A`), `teaching_arthur_escapement_basics`, golden snapshot regen | Append-only golden additions; zero edits to Nora/Clara/other dialogue files |
| **LR5-Scene** | `src/scene/NeighborhoodCanvas.tsx` | `copperwheelOccupantRig` + hitProxy + raycast priority + standing `'work'` pose parameterization + winter tint | Parameterized loop shared with Nook/Bakery; zero `tick()` allocations |
| **LR5-QA** | `src/game/lr5-arthur.test.ts`, `src/scene/copperwheelInterior.test.ts`, 4 tail-pin updates | Full `LR5-01..LR5-14` + cross-venue & spatial walkability verification | Protects LR-3/LR-4 runtime guarantees |

---

## 5. Adversarial QA Pre-Implementation Failure-Mode Matrix

1. **Phantom sitting hover**: Copperwheel occupant forced to `'sit'` at `y = 0.56` with `seatedReading: true` -> prevented by explicit `pose: 'work'`, `y: 0`, `seatedReading: false` config per venue rig.
2. **Golden-Hour false eligibility (`D-5B`)**: Arthur at Gazebo Steps (`5.69m <= 6.0m`) passing `isHostAvailableForActivity` -> prevented by `offerPhases: ['morning', 'dusk']`.
3. **Unvisited workshop premature invitation (`D-5A`)**: Offering workbench hour before `sideFlags.copperwheelVisited` is unlocked -> prevented by `sideFlagsTrue: ['copperwheelVisited']`.
4. **Bench counter / completion double-dip (`doc 13:91`)**: Clicking bench or calling `checkWorkbenchProjectAction` during an accepted visit -> prevented by `isCopperwheelSessionClaimingStation` guard + PropCard delegation to `'share_workbench_hour'`.
5. **Dual-surface divergence**: Clicking Arthur (`dialogue`) vs clicking `cw_bench` (`PropCard`) -> both route into `completeSharedActivity(world, activityId)` (`App.tsx` resolves live `invitations.active.activityId`), producing bit-identical world deltas.
6. **Post-visit teaching echo starvation**: Generic `everyday_shared_visit_echo` stealing Arthur's `unmentionedOnly` memory before `teaching_arthur_escapement_basics` -> prevented cleanly (and note: `everyday_shared_visit_echo` triggers on `['shared_featured_reading']`, plus `teaching_arthur_escapement_basics` sits at priority 20 = score 88 > echo ceiling 87).
7. **`bench_rest` day (Day 4, 8, ...) awkward prose**: Copy referencing "today's rolling felt" clumsily -> `summaryCompose`, `cw_bench` PropCard, and Arthur's indoor dialogue adapt gracefully when `getProjectForDay(day).id === 'bench_rest'`.
8. **Cross-venue leak & exit/re-entry orphan**: Entering Nook/Bakery with Arthur invite must leave occupancy `null` and keep Arthur's invite `'accepted'`; exiting Copperwheel clears occupancy & `activeActivity` while preserving the accepted invite until completion or window expiry.

---

## 6. Post-Implementation Verification & Runtime Evidence (2026-11-27)

- **Automated Gates**: `npm test` (**1086/1086** passing, `0` failures, incl. `lr3-restday-gate.test.ts` merged from `main` PR #45 + `src/game/lr5-arthur.test.ts` + `src/scene/copperwheelInterior.test.ts`), `npm run lint` (`tsc --noEmit` 0 errors), `scripts/check_layer_boundaries.ts` (0 new violations), `scripts/longrun_stress.ts --quick` (clean, byte-identical replay & twin continuity), `npm run build` (`vite build` green).
- **Live Browser & Visual QA (`http://localhost:3000/?autostart=1`, headless Chromium)**:
  - **Desktop (`1440×900`)**: Verified outdoor `inv_arthur_offer_workbench` dialogue -> accept; Copperwheel interior occupancy (`Arthur` standing `'work'` pose at `CW_OCCUPANT_POS`, `y = 0`, clear of `cw_bench` and `cw_shelf`, HUD prompt `"Share Workbench Hour with Arthur [E]"`), live completion saving `arthur_escapement_basics` and `mem_lr_arthur_workbench_hour` while preserving `copperwheelState` solo counters (`0`), exterior `teaching_arthur_escapement_basics` follow-up dialogue UI, and `localStorage` persistence across `page.reload()` (`0` console errors / `0` page errors).
  - **Mobile (`390×844`)**: Verified zero horizontal overflow (`scrollWidth === 390 === innerWidth`), clear framing of Arthur + player inside Copperwheel Workshop, touch-friendly HUD, and `0` console/page errors.

