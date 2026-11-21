# LR-3 Scope & Acceptance

- **Date**: 2026-11-21
- **Status**: Discovery deliverable (Phase One). Defines the scope of record for LR-3 and its acceptance criteria. Implementation remains gated (see §5).
- **Authority basis**: derived from `14-revised-architecture.md` §10 (spec of record) and `15-implementation-readiness-checklist.md` §3; inherits the LR-2 acceptance battery (`16-lr1-lr2-acceptance-test-plan.md`) and the as-built contracts (`HANDOVER.md` §16/§17).

---

## 1. Scope of record

### 1.1 In scope

| ID | Item | Source |
|---|---|---|
| S1 | Bakery interior occupancy via the door-enter pattern: occupant + `activeActivity` set only in `enterBakeryAction` after expiry reconcile, `isInvitationLive`, and `isHostAvailableForActivity`; cleared on exit/expire/complete/day-advance/sanitize | `14-revised-architecture.md:142-160` |
| S2 | `share_morning_pastry` activity def (host Clara, location `bakery_interior`) in the `SHARED_ACTIVITIES` registry | `14-revised-architecture.md:290`; reserved id `10-milestone-roadmap.md:9` |
| S3 | Station exclusivity: while the invite is live or the activity active at the linked bakery station, the ordinary knead/share/bake primary actions are suppressed or visibly refused; shared completion must not mutate `kneadedDay`, `loafSharedDay`, `kneadingSessions`, `loavesShared`, `shelfBrowsedDay`, `teaSharedDay`, `booksRead`, or greenhouse plot fields | `14-revised-architecture.md:203-209`; `15-…:86-88` |
| S4 | Clara schedule gate: offer suppressed while her phase slot is outside the 6 m home radius (afternoon Fountain Plaza auto-blocks); offer window capped at her contiguous home-availability boundary (D-17 policy applied to Clara's schedule, not Nora's constants) | `15-…:90`; recovery doc 05 §3 |
| S5 | Clara invitation dialogue quartet in `dialogue/invitations/clara.ts` (offer / pending re-ask / in-room completion / reminder), aggregator spread, golden-snapshot regeneration with justification | `14-revised-architecture.md:243-244` |
| S6 | Player-facing legibility: venue-truthful toasts (accept/enter/refusal), station card, occupant hit-target label, journal "Today's Invitation" card (already registry-generic) | conventions §16/§17 as-built |
| S7 | Persistence: round-trip + load-invariant tests; sanitizer behavior for any new persisted state per the persistence contract (currently expected to add **no** schema version — decision D7) | `14-revised-architecture.md:300-308` |
| S8 | Regression: the full existing suite stays green, including the LR1/LR2 batteries, tick/load parity pins, dialogue golden contract, and venue suites | `15-…:100-106` |

### 1.2 Out of scope (with reasons)

| Item | Reason |
|---|---|
| Teaching / knowledge grants (writing `teaching.known`, `requiresTeachingKnown` content) | LR-4 per doc 14 §10; acceptance asserts the field stays empty after LR-3 completions |
| Mina / Sunbeam Greenhouse hosting | Not in doc 14 §10; greenhouse has no seat spots or occupant rig; would be a new milestone's work |
| Arthur / Copperwheel hosting | LR-5 sequencing (`14-revised-architecture.md:297`) |
| A second simultaneous invitation or second occupant slot | Architecture keeps one active invitation globally and one occupancy slot |
| New currencies, decay, cooldown penalties, skill-tree UI, relationship-score grinding | Readiness condition (`15-…:106`) and design principles |
| Real-world-time gating anywhere | Design principle 4 |
| New dialogue engine, second memory system, social-event framework | Prohibited duplication (`14-revised-architecture.md`; initiative §8 avoid-list) |
| Merge/publish of the Systemic Reliability branch | Explicit authorization boundary; separate reviewable PR when the owner directs |

## 2. Design decisions to pin before implementation

These are the documented ambiguities (doc 01 §7) converted into decision slots. Each must be settled and recorded (decision-record doc, following doc 21 conventions) before feature code is written.

| ID | Decision | Options | Evidence tilt |
|---|---|---|---|
| D1 | Venue scope confirmation: LR-3 = Clara/bakery only | (a) bakery only (doc 14 §10 — recommended); (b) bakery + greenhouse family (HANDOVER "LR-3+" umbrella) | Doc 14 is the spec of record; (b) would need new anchors Mina's greenhouse lacks |
| D2 | `share_morning_pastry` def parameters: duration, `minTier`/`minAffinity`, memory id/title, `npcMemoryTag`, `stationId`, `seatPos`/`seatFacing`; Clara's offer-window cap computed from her schedule | Superseded doc 06 sketch (Clara / bakery table / 8 min / `clara_tea_and_crumb`) is indicative only; Nora's def (`activities.ts:53-71`) is the as-built reference | D-17 cap must be computed from Clara's contiguous home phases |
| D3 | Occupant anchor station: café chair (`bakery_seat_cafe_west`, the only as-built seat) vs a new table station | Café chair: reuses `BAKERY_SEAT_SPOTS`, conflicts with solo sit (needs suppression). New table station: no sit-clash but new seat data + walkability evidence | Doc 13:91 documents the clash; doc 06 says "bakery table" (superseded) |
| D4 | Clara offer discoverability gate | (a) tier/affinity only (generic gates already exist); (b) a designed story gate like Nora's postcard | Nora's gate is a documented designed pattern (recovery doc 05 §5); Clara has the bellQuest/orchard arcs as candidates |
| D5 | Enter-path shape: duplicate the nook block in `enterBakeryAction` vs extract a shared enter-reconcile helper adopted by both venues | Shared helper is the reliability branch's recorded revisit direction for F-ENTER-1; duplication is the pattern it says to avoid | Depends on the reliability gate (§5); helper is recommended either way |
| D6 | Venue-derived accept toast (fix `actions.ts:901` hardcode) | Derive from `getSharedActivityDef(activityId).location` / `RESIDENTS[host].homeName` | One-line architecture fix; keeps both venues truthful |
| D7 | Persistence: registry-only (no schema bump) vs new persisted state (v12) | Registry-only preferred; any genuinely new field forces `migrateV11ToV12` + sanitizer/revision/clone updates + GUARD fixtures | Doc 02 §3; doc 14 §9 policy |
| D8 | Bakery occupant scene rig: parameterize the existing nook occupant-rig pattern vs a second hardcode | Parameterized path recommended (one venue-agnostic occupant rig feeding on `occupancy`) | `NeighborhoodCanvas.tsx:922-939, 2062-2109` |

## 3. Acceptance criteria

### 3.1 Inherited LR-2 battery (must pass unchanged, re-parameterized for bakery)

From `15-implementation-readiness-checklist.md:75-83` and the as-built LR-2 suites — the doc-14 LR-3 row requires "Same occupancy, day-advance, and load tests as LR-2" (`:85`):

1. Enter during a live accepted bakery invite places Clara as occupant with matching `activeActivity` (occupancy triple: resident/station/invitation).
2. Enter with a distant-slot (expired) invite expires the invitation with the visible line; no occupancy is set (no retroactive occupancy).
3. Counters unchanged by enter/occupancy: no `bakeryState` day-stamps move on shared-activity paths.
4. Player sit/primary action on the occupied station is rejected with visible feedback until completion/expiry.
5. Rest-until-morning / day-advance clears occupancy and expires per the strict predicate.
6. Save/load restores-or-clears a mid-visit state per the load invariant (LR2-15/16 analog), including sanitizer coherence between `occupancy` and `activeActivity`.
7. Host-only memory: the Clara memory created by completion is not gossip-eligible to low-affinity neighbors (LR2-13 analog).

### 3.2 LR-3-specific battery (doc 15:86-90, verbatim obligations)

1. `completeSharedActivity` for `share_morning_pastry` does **not** change `kneadedDay`, `loafSharedDay`, `kneadingSessions`, or `loavesShared`.
2. Same-day knead still doubles the solo share exactly as it does today when the shared activity is not used (no regression of the knead-first bonus).
3. Clara offer is suppressed when her phase slot is away from home (afternoon), and the computed window never exceeds her contiguous home-availability boundary.
4. Duplicate completion and pre-seeded memory id are strict no-ops (LR2-07/07b analog).
5. Completion awards +6 affinity / +2 reliability outside the daily small-talk cap (LR2-09/10 analog) — no new currency, no decay.
6. Tick/load parity for a bakery invite: stepSimulation expiry matches save/load expiry minute-for-minute (LRTL analog for the second host).
7. Dialogue: offer surfaces within two ordinary interactions once eligible (NR-01 analog); golden snapshot updated with written justification.
8. `teaching.known` remains empty after every LR-3 pathway (guard against the doc-10 trap).

### 3.3 Persistence gates (doc 14:300-308, binding)

- Every persistence-touching test calls or is called by `advanceToNextDay` and asserts clear/expire.
- Round-trip a save and assert the load invariant.
- Use the §9 schema policy, not a hardcoded version number, in gates.

### 3.4 Required test categories (initiative Phase Four mapping; full plan lands as lr3 doc 06)

A relationship behavior (valid in-world progression, no arbitrary counters) · B NPC autonomy (host availability, tick skip) · C social knowledge (host-only memory boundary) · D dialogue accuracy (occupancy-aware conditions) · E activity lifecycle (valid/invalid transitions) · F persistence (round-trip incl. mid-activity save) · G determinism (seeded replay) · H long-run (repeated invites across days; history cap rollover) · I regression (full suite + LR1/LR2 batteries + venue suites).

## 4. Constraints inherited from the as-built contracts (binding on any LR-3 implementation)

1. **Strict predicate duality**: `isInvitationExpired === !isInvitationLive` across tick, save and load (`HANDOVER.md:170-173`; D-03).
2. **Anchored windows**: offer-window end capped by contiguous home availability; no copied constants across hosts (D-17 policy).
3. **Occupancy write ownership**: occupancy is set ONLY by the interior enter reducer; the tick never creates occupants; `activeActivity` anchors to the live active invitation (doc 14 §4.3 / LR1-15b as reaffirmed by the recovery).
4. **Completion-time re-check**: the H-1 host-encounter drift refusal applies to the bakery completion path unchanged.
5. **No sanitizer ceilings** for legitimately unbounded counters (AR-4 disposition), and no unit-clear of occupancy/`activeActivity` (rejected in adversarial review — do not re-propose).
6. **Golden snapshots** regenerate only from the live registry with documented behavioral justification.
7. **Headless simulation stays authoritative**; the tick path remains allocation-free (`stepSimulationInPlace` untouched; purity regression test stays green).

## 5. Gate status & execution strategy

**Reliability integration gate: NOT satisfied** (doc 01 §8). Execution strategy, per the initiative's authorization boundary:

1. **Now (this branch):** discovery + design work only — docs 01–03 (this delivery); Phases Two–Four deliverables (research doc 04, target architecture doc 05, acceptance test plan doc 06) may follow on the same docs track.
2. **Before any LR-3 feature code:** one of —
   - **(a)** the Systemic Reliability branch is published, independently reviewed and merged (recommended: it is verified 459/459, low-conflict, and directly load-bearing for LR-3), and LR-3 branches from the integrated main; or
   - **(b)** the project owner explicitly authorizes LR-3 on unhardened main — then the F-ENTER-1 shared-enter-path correction and a persistence-contract equivalent must be re-derived inside the LR-3 branch, clearly attributed as such in its decision record, and re-reviewed when the reliability work lands; or
   - **(c)** the project owner defers LR-3; the discovery record stands.
3. **Stop condition (binding):** no LR-3 feature code is written, and no assumption that the reliability corrections are integrated is embedded in any design artifact, until one of the above is chosen. This document set is the delivered stopping point for the current authorization level.

## 6. Traceability

| Requirement | Design source | Code seam (doc 02 §5) | Test obligation |
|---|---|---|---|
| Bakery occupancy | doc 14 §10 / §4 | S1 → seam 3, 10 | §3.1 items 1-6 |
| `share_morning_pastry` | doc 14 §10; reserved id doc 10:9 | S2 → seam 1, 4, 5 | §3.2 items 1, 4, 5 |
| Station exclusivity | doc 14:203-209; doc 13:91 | S3 → seam 9 | §3.1 item 4; §3.2 items 1-2 |
| Clara schedule gate | doc 15:90; D-17 policy | S4 → eligibility (unchanged) + window test | §3.2 item 3 |
| Clara dialogue | doc 14:243-244 | S5 → seam 7 | §3.2 item 7 |
| Legibility | as-built conventions | S6 → seam 6, 8 | §3.1 item 4; QA scenarios (doc 06) |
| Persistence | doc 14:300-308 | S7 → D7 outcome | §3.3 |
| Regression | doc 15:100-106 | S8 → all | §3.4 category I |
