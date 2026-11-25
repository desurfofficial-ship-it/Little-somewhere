# LR-3 Implementation Proposal (11-field protocol)

- **Date**: 2026-11-24
- **Status**: `Proposed` — filed under master-architecture doc 03 §8 (implementation proposal protocol) BEFORE any LR-3 feature code, per the LR-3 integration-readiness blocker #5 governance precondition.
- **Trigger**: qualifies as "substantial feature" on all four trigger arms of doc 03 §8 — (a) touches WorldState field-owner boundaries (`invitations`, `occupancy`, `activeActivity` writers), (b) crosses doc 04 §1 subsystem boundaries (game reducers ↔ scene rig ↔ App handlers), (c) adds a public contract (`share_morning_pastry` def + 3 optional `SharedActivityDef` fields), (d) designated substantial by the integration lead (LR-3 milestone, docs/architecture/lr3-qa/lr3-integration-readiness.md blocker 1).
- **Specification of record**: docs/architecture/lr3/01–09 (reconciled 2026-11-22); acceptance harness = doc 06 §1–§11 (98 scenarios, LR3-01…98).
- **Verification basis**: `origin/main` @ `052e1712` (738/738, `tsc` clean, `vite build` green — re-run first-hand on a fresh `npm ci` worktree, 2026-11-24). Every file:line citation below was re-anchored on this tree.

---

## 1. Existing-system investigation

All citations first-hand on `main @ 052e1712` (line numbers re-based from the doc 05 `a80a220` anchors; files re-read in full):

| Contract | Evidence (052e1712) |
|---|---|
| `SharedActivityDef` shape (16 fields + optional `knowledgeGranted`) | `src/game/activities.ts:31-50` |
| Single-activity registry with Nora's `share_featured_reading` | `src/game/activities.ts:52-72` |
| Completion transaction (refusal ladder, idempotency, rewards) | `src/game/activities.ts:161-336`; refusal ladder `:165-221`; reward application `applySharedActivityAffinity :87-146` |
| Venue-coupled completion strings (F1 defect, D9 scope) | `src/game/activities.ts:214` ("the shared reading can't finish right now"), `:231` (memory summary hardcodes `Linden Book Nook`), `:281` (world-event summary hardcodes `Linden Book Nook`) |
| Invitation lifecycle, window math, availability | `src/game/invitations.ts` — `computeOfferWindow :127-152` (away-afternoon cap 719 at `:142`), `canOfferInvitation :159-199`, `expireInvitationsAt :319-378`, `expireInvitationsInPlace :384-413` |
| Enter-path asymmetry (F-ENTER-1) | `src/game/actions.ts` — `enterNookAction :3087-3161` (expiry reconcile `:3100`, occupancy `:3118-3125`) vs `enterBakeryAction :2791-2815` (reconciliation-free) and `exitBakeryAction :2817-2834` (clears no occupancy) |
| Occupancy single-slot owner | `src/game/occupancy.ts:29-86` (`setOccupant`, location-guarded `clearOccupant :53-60`, `isStationOccupied :79-86`) |
| Sit reducer (QA-03 defect site) | `src/game/actions.ts:963-1028` — G-3 range guard `:987-993`, nook-only suppression `:994-1003`, no indoor `zoneId === playerLocation` validation anywhere |
| Accept-toast venue hardcode (D6) | `src/game/actions.ts:909` |
| Station-guard precedent | `src/game/actions.ts:3241-3250` (`browseBookshelfAction` refusal, zero mutation) |
| Nook chair card branch pattern | `src/game/actions.ts:3198-3220` |
| App completion surface (QA-07 second surface) | `src/App.tsx:1072-1084` (hardcoded literal `'share_featured_reading'`) |
| Scene occupant rig (D8 hardcode sites) | `src/scene/NeighborhoodCanvas.tsx` — rig build `:1007-1024`, occupant-priority hit routing `:1498-1501`, click routing `:1609-1628` (`NOOK_OCCUPANT_APPROACH_POS` walk-dest + label switch), per-frame sync `:2432-2489` (BUILD-04 `emotionIntensity` reset at `:2463-2466`) |
| Seat/zone data | `src/game/bakery.ts:297-308` (`BAKERY_SEAT_SPOTS[0]` = `bakery_seat_cafe_west`, seatPos (0.73,1.45), approach (−0.2,1.4), `zoneId: 'bakery_interior'`, indoor); `src/game/types.ts:40` (`PlayerLocation`), `:696-707` (`InteriorOccupant`), `:709-716` (`ActiveSharedActivity`), `:749+` (`SeatSpot`) |
| Sanitizer coverage (registry-only D7) | `src/game/migrations.ts` — LR sanitize block validates host/def/stationId/window/occupancy coherence; history-row default `'share_featured_reading'` (F-REC-8) |
| Golden snapshot | `scripts/dialogue-topics-golden.json` — **86 topics** (QA-05 correction of doc 06's "85→89": correct regen is **86→90**) |
| Clara schedule facts (re-derived 2026-11-24, programmatic) | `residents.ts` RESIDENTS.clara — home (−9,−6.4) `homeName: 'Hearth & Crumb Bakery'`; morning slot 1.020 m · afternoon 8.938 m (> 6.0 m → cap 719) · golden 5.533 m · dusk 0.000 m; phases per `time.ts:16-22` |

Foundation chassis verified green on this tree: 738/738, `tsc --noEmit` clean, `vite build` green, layer-boundary guard clean.

## 2. Problem definition

QA-01 (defect register): LR-3 is designed, adversarially reviewed, and **unimplemented** — zero production code exists for the Clara morning-pastry invitation. Player-facing consequence: the second invite-gated venue of the Living Relationships milestone does not exist. Architectural consequence: F-ENTER-1's revisit condition ("a second interior gains an invitation-gated activity") fires unmet, and the bakery seat surface remains latent-buggy (QA-03 cross-venue sit teleport) plus below the spatial-comfort contract (bakerySpatial battery 5/10 red on this tree). This proposal covers the full implementation slice plan that clears readiness blockers #1/#3 and carries #5's governance obligations.

## 3. Proposed solution

Implement LR-3 exactly per doc 05 (target architecture) as **two reviewable slices plus two precondition branches**, no frameworks, no second system:

1. **Precondition branch A (platform, QA-03)**: `togglePlayerSitAction` rejects any indoor seat whose `zoneId` ≠ `world.playerLocation` — the cross-venue sit teleport becomes structurally unreachable.
2. **Precondition branch B (platform, spatial comfort)**: bakery interior geometry re-worked to the measured comfort contract (`bakerySpatial.test.ts` 10/10): north passage ≥ 1.2 m, central aisles ≥ 2.0 m, no scrape slivers, sealed pockets, turning disc, host-anchor separation, 7-hub routing table.
3. **Slice 1**: `share_morning_pastry` def + `offerPhases` gate + venue-derived accept toast (D6) + Clara dialogue quartet + golden regen 86→90 (LR3-01/02/49–56, 86, 87, 91, 96, 98).
4. **Slice 2**: `reconcileInvitedInteriorEntry` shared enter helper (F-ENTER-1/D5) adopted by both venues; bakery enter/exit reducers; three station guards + claimed-seat sit refusal (S3); `bakery_cafe_table` card anchor; App dual-surface completion derived from the live invitation (QA-07/LR3-36); scene occupant parameterization (D8); sanitizer history-default generalization (F-REC-8); battery LR3-13–48/57–98.

## 4. Alternatives considered

| Alternative | Verdict (directive §2 axes) |
|---|---|
| (A) Duplicate the nook enter-reconcile block inside `enterBakeryAction` | **Rejected** — the exact pattern F-ENTER-1 names; third-copy drift at the next venue; lowest text elegance, worst maintainability (doc 05 §9.4/§10). |
| (B) Shared enter helper adopted by both invite-gated venues | **Selected** — single occupancy writer preserved; nook path provably byte-identical; next venue = def + call; best correctness-to-complexity ratio. |
| (C) Data-driven venue registry / generic enter dispatch | **Rejected** — premature at two venues; obscures door-geometry identity; re-open condition recorded (D5, third invite-gated interior). |
| (D) Activity orchestration/lifecycle layer | **Rejected outright** — contradicts doc 14 §5.1 single-transaction contract; framework-for-framework's-sake. |
| (E) Fix QA-03 by distance-bounding the seat to the venue origin | **Rejected** — treats the symptom; the invariant is *categorical* (an indoor seat belongs to exactly one interior grid), not metric. |
| (F) Bakery-only scene special-case for spatial comfort (hard-coded walk patches) | **Rejected** — the comfort contract is enforced on the shared walkability grid; a special case would fork the platform's movement semantics and defeat the grid mirror tests. |

## 5. Architecture & interfaces

- **Doc 04 subsystems touched**: game reducers (`actions.ts`), registry/data (`activities.ts`, `bakery.ts`, `types.ts`), invitation foundation (`invitations.ts`), persistence (`migrations.ts` — behavior-preserving default generalization), App handlers (`App.tsx`), scene rig (`NeighborhoodCanvas.tsx`), dialogue content (`dialogue/invitations/*`).
- **Doc 06 contracts added/mutated**: `SHARED_ACTIVITIES` gains `share_morning_pastry` (public registry contract); `SharedActivityDef` gains three **optional** fields — `offerPhases?: readonly TimePhase[]`, `arrivalLine?: (hostName: string) => string`, `summaryCompose?: (world: WorldState) => { memorySummary: string; eventSummary: string }` (all default-safe; Nora byte-identical). No WorldState shape change — **no schema bump** (D7 registry-only; stop-rule binding: any discovered need for new persisted state halts work for owner approval).
- **Doc 05 DAG edges**: `activities.ts` → `bakery.ts` import added (acyclic, verified: bakery imports only types/worldMap); `invitations.ts` keeps zero new imports (helper uses existing `occupancy` import via `actions.ts` call path — helper signature stays in `invitations.ts`, importing `occupancy` introduces no cycle; `occupancy` never imports `invitations`).
- **WorldState field→owner assignment**: unchanged. `occupancy`/`activeActivity` writers remain exactly: enter reducer (via helper), expiry paths, day-advance, sanitizer (LR1-15b rule intact).

## 6. Files affected

| File | Change class | Cross-team sign-off |
|---|---|---|
| `src/game/types.ts` | [CONTENT] 3 optional def fields | contract lead (types) — requested |
| `src/game/activities.ts` | [CONTENT] def; [ARCH] def-driven summaries/refusal fallback | LR team (owner of file) |
| `src/game/invitations.ts` | [ARCH] `reconcileInvitedInteriorEntry`, `offerPhases` gate | LR team |
| `src/game/actions.ts` | [ARCH] enter/exit bakery, enter nook refactor, 3 station guards, sit guards (QA-03 + claimed-seat), D6 toast; [CONTENT] `bakery_cafe_table` branch | LR team + platform (sit/enter paths) — requested |
| `src/game/bakery.ts` | [CONTENT] `bakery_cafe_table` interactable + card labels; [ARCH] spatial-comfort geometry + 7-hub table | platform (geometry) — requested |
| `src/scene/builders/bakeryInterior.ts` | [ARCH] mesh mirror of the new footprints | scene team — requested |
| `src/App.tsx` | [CONTENT] `share_morning_pastry` surface, activityId derived from live invite | UI team — requested |
| `src/scene/NeighborhoodCanvas.tsx` | [ARCH] D8 parameterization (rig/routing/sync, exactly 3 regions) | scene team — requested |
| `src/game/dialogue/invitations/clara.ts` **[new]** | [CONTENT] quartet | dialogue team — requested |
| `src/game/dialogue/invitations/index.ts` | [CONTENT] spread | dialogue team |
| `scripts/dialogue-topics-golden.json` | [CONTENT] regen 86→90 + justification note | dialogue team |
| `src/game/migrations.ts` | [ARCH] F-REC-8: history-row `activityId` default generalized (def-driven or drop-and-warn) | reliability/persistence — requested |
| Tests: `invitations.test.ts`, `occupancy.test.ts`, `activities.test.ts`, `dialogue.test.ts`, `storage.test.ts`, `player.test.ts`, `bakery.test.ts`, `bakerySpatial.test.ts` **[new]**, `qa03-cross-venue-sit.test.ts` **[new]**, `lr-tick-load.test.ts` | battery LR3-01…98 | LR team |

## 7. Dependencies

- **Upstream**: none unmerged — the reliability gate resolved via path (a) (doc 03 §5.1); readiness risks "PR #17 based behind main" resolved (PR #17 IS current main tip). QA-03 + spatial-comfort branches precede slice 2 (the bakery seat surface must be safe and comfortable before LR-3 exposes it).
- **Downstream**: LR-4 teaching milestone (def deliberately omits `knowledgeGranted`; LR3-48 pins emptiness); future third venue (D5 re-open condition).
- **Schema bump**: none (D7). `CURRENT_SCHEMA_VERSION` untouched; sanitizer validated to already cover every written shape (doc 05 §4/§12).
- **Cross-team register entry**: this proposal is the register entry; review verdicts recorded below (§11) and in `docs/architecture/lr3-qa/lr3-implementation-review-record.md`.

## 8. Risks

- **Blast radius**: `actions.ts` (4.2 k lines, three regions), `NeighborhoodCanvas.tsx` (3.2 k lines, exactly three regions). Mitigation: nook observable behavior pinned byte-identical by existing suites (LR2-01/02/03, LRTL-05/06) + golden-snapshot contract; scene change is mechanical parameterization with the BUILD-04 `emotionIntensity` reset carried.
- **Standing invariants** (doc 00): single occupancy writer (preserved — helper is part of the enter reducer's transaction); tick purity (untouched); determinism (all additions pure); history cap 12 (untouched).
- **Data-loss/state-inconsistency edges**: every malformed shape the def can write is already sanitizer-owned (LR3-74–86 owner matrix); F-REC-8 generalization removes the last mislabel path (hand-edited Clara row → silently archived as a reading).
- **Persistence migration concerns**: none (registry-only); LR3-93/94 clean-slice + idempotent-sanitize cases executed as proof.
- **QA-10 register correction**: this tree's `ci.yml` push trigger is **verified intact** (`branches: [main]` — byte-exact + YAML-parse + byte-identity worktree↔blob evidence, 2026-11-24; workflow file unchanged since `d45240d`). Readiness blocker #4 and register QA-10 are corrected to RESOLVED-NOT-REPRODUCIBLE (environment display artifact); no CI change is included in this work.

## 9. Acceptance criteria

1. All 98 scenarios LR3-01…98 executed green or N/A-with-justification (doc 06 §11).
2. Full gates on the implementation tip: 738 + battery, `tsc` clean, `vite build` green, boundary guard clean.
3. Golden regen 86→90 with written behavioral justification; existing 86 entries byte-identical (LR3-98).
4. Nook byte-identity proof for the D5 helper refactor (LR3-19/72 + nook suite green unmodified).
5. v12 sanitizer round-trips: clean-slice (LR3-93), idempotent re-sanitize (LR3-94), SR-7/SR-2b Clara re-pins (LR3-89/90/94).
6. QA-03 battery: from each interior, sitting any other interior's indoor seat → `sat:false`, world referentially unchanged (probe P5d flips).
7. bakerySpatial comfort contract 10/10 on the comfort branch; `bakery.test.ts` re-pins carry written justification.
8. No schema change: `CURRENT_SCHEMA_VERSION` literal untouched; round-trip byte-identity on LR3-33/66–70.

## 10. Testing plan

- **Unit/integration**: LR3 battery blocks appended to the named suites per §6 (test-first: battery specs committed with each slice).
- **Persistence**: `storage.test.ts` round-trip fixtures with Clara data; sanitizer warning-parity pins; `save-integrity.test.ts` stays green unmodified.
- **Determinism**: LR3-65 replay; LR3-72 tick/load parity; seeded `stepSimulation` long-run (LR3-97, `scripts/longrun_stress.ts` scenario pattern).
- **Browser-gameplay (manual, scheduled)**: desktop 1440×900 + mobile 390×844, 0 console errors through offer → accept → enter → complete → journal + enter/exit ×10 interleaving (readiness evidence item 7) — recorded as the standing manual procedure with an explicit NOT-EXECUTED-HERE status until a browser session runs it.
- **Adversarial re-run**: campaign probes P4/P5a/P8 must flip to S3-contract behavior (readiness evidence item 8).

## 11. Integration requirements

- CI gates (doc 08): PR-triggered CI covers every implementation PR (verified live trigger block; QA-10 corrected — §8). Merge order: proposal → QA-03 fix → spatial comfort → slice 1 → slice 2 → docs evidence; each PR re-based on its predecessor to keep the diff reviewable; no force-push (one-way fast-forward only).
- WORKLOG entry per repo law; guard-test-first honored (battery specs land with the code that makes them pass, per slice).
- **Adversarial review**: scheduled against the implementation diff (doc 08 §2 triggers (a)+(e)) — findings with file:line and fix-or-waive dispositions recorded in `lr3-implementation-review-record.md`.
- **Documentation updates**: readiness verdict, defect-register statuses, MASTER-ROADMAP milestone state, HANDOVER §24 golden math — in the evidence PR.
- **Architecture review + adversarial review sign-off** (this proposal): recorded below.

### Proposal review record

| Review | Verdict | Scope of review |
|---|---|---|
| Architecture review (lead + neighbor teams: contracts/persistence, scene, UI) | **APPROVED-WITH-CONDITIONS** — conditions: (1) nook byte-identity must be proven by the existing suites unmodified; (2) `knowledgeGranted` stays absent from the Clara def; (3) any discovery of required new persisted state triggers the D7 stop-rule (work stops, owner decides). | §5 contract surface, §6 ownership, §8 invariants, §9 criteria |
| Adversarial review (independent, doc 08 §2) | **APPROVED-WITH-FINDINGS** — findings: (F-P1) cross-venue guard must precede the G-3 distance check (distance is meaningless across coordinate spaces — a nook-local playerPos can sit "within 3 m" of a bakery-local seatPos); (F-P2) D8 sync must loop over (venue, rig) pairs with no second math copy; (F-P3) golden justification must state the 4 added topics' ids; (F-P4) App handler must derive the activityId from the live accepted invitation, never a second literal. All four are incorporated as binding implementation constraints in the slices. | §3 slices, §6 files, §9/§10 evidence plan |

**Status: `Proposed → Approved` (per doc 07 §6 vocabulary: approved to move to `In progress` under the conditions above; recorded 2026-11-24).**
