# LR-3 Current Capability & Dependency Audit

- **Date**: 2026-11-21 (reconciled 2026-11-22)
- **Status**: Discovery deliverable (Phase One). Docs-only; contains no code changes. Carries 2026-11-22 reconciliation updates marked **[Reconciled]**; the original `962fb07`-era record is preserved.
- **Audit target**: `origin/main` @ `962fb07` (verified baseline: **447/447 tests, `tsc` clean, production build green**). All `file:line` references are to that tree unless marked **[Reconciled `a80a220`]**.
- **Authority basis**: companion to `01-authoritative-milestone-discovery.md`; uses the doc-14 LR-3 definition.
- **Reconciliation provenance**: re-verified against main `a80a220` (528/528 first-hand) after the Systemic Reliability integration (PR #11) — see §1.1, §5.1, §6.1.

---

## 1. Baseline verification

Verification performed first-hand on an extracted `962fb07` tree, 2026-11-21:

| Check | Command | Result |
|---|---|---|
| Test suite | `npm test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`) | **447/447 pass, 0 fail** |
| TypeScript | `npm run lint` (`tsc --noEmit`) | **0 errors** |
| Production build | `npm run build` | **green** (pre-existing chunk-size warning only) |
| Test inventory | file census | **28** game + **27** scene test files |

The suite census matches the WORKLOG 053 record ("integrated tree passes 447/447") and the BUILD 02 reconciliation note ("PR #5 (Build-10/LR recovery) integrated; 447/447").

### 1.1 Reconciliation-era baseline (2026-11-22, first-hand on `a80a220`)

| Check | Command | Result |
|---|---|---|
| Test suite | `npm test` | **528/528 pass, 0 fail** (489 main base + reliability + integration-repair additions; recorded in HANDOVER §19, re-run first-hand here) |
| TypeScript | `npm run lint` (`tsc --noEmit`) | **0 errors** |
| Production build | `npm run build` | **green** (pre-existing chunk-size warning only) |
| Test inventory | file census | **30** game + **33** scene test files (63 total); new since `962fb07`: `save-integrity.test.ts` (37 cases), `progressionVisuals.test.ts` (15), `progressionPresentation.test.ts` (10), `environmentRendererProgression.test.ts` (5), `ambientSway`/`cottageProgressionTiers`/`uiTokenDiscipline` (3 each), `itemSubjectMapping.test.ts` (1) |
| LR-surface deltas | `git diff 962fb07 a80a220 -- src/game/` | the reliability integration touched `migrations.ts` (+331), `storage.ts` (+44), `simulation.ts`, `journal.ts` (+18), `storylines.ts`; `actions.ts`, `invitations.ts`, `activities.ts`, `occupancy.ts`, `residents.ts`, `bakery.ts`, `bookNook.ts`, `types.ts`, `relationships.ts`, `memories.ts`, `dialogueEngine.ts` are **byte-identical** — every §2 capability row below still cites valid code |

## 2. Capability matrix

The Phase One required classification. "Remaining work" is scoped to LR-3 only (the doc-14 definition); gaps that belong to later milestones are noted as such.

| Capability | Status | Evidence (production) | Evidence (tests) | Remaining work for LR-3 |
|---|---|---|---|---|
| Relationship foundation | **Verified implemented** | `relationships.ts` — `getRelationshipTier` (:38, tiers stranger→kindred), `TIER_RANK` (:30), `isResidentGuarded` (:85), `createInitialPlayerRelations` (:160), `recordPlayerTalkAffinity` (:286, daily cap 20), `applyNpcSocialRelationInPlace` (:424); state at `types.ts:737` (`playerRelations`, affinity/familiarity/reliability) | `relationships.test.ts` (tiers, Day-1 trust-farming exploit block, greeting-distance effects) | **None.** Eligibility already reads tier/affinity generically for any host (`invitations.ts:159-199`) |
| NPC-to-NPC relationships | **Verified implemented** | `BASELINE_NPC_BONDS` (:186) + `createInitialNpcRelations` (:205), `adjustNpcRelationPair` (:258), `reconcileClaraAndArthurRelation` (:405), gossip cooldown fields on `NpcNpcRelation` | `relationships.test.ts` ("reconciliation upgrades arthur:clara bilateral NPC relationship") | **None.** Clara/Arthur baseline bond already models the venue lore |
| NPC memories | **Verified implemented** | `memories.ts` — provenance ranks firsthand/secondhand/rumor (:174 record), TTL expiry (`EPHEMERAL_RUMOR_TTL_DAYS=5`, `DURABLE_MEMORY_TTL_DAYS=18`, :330), caps 14+6 (:33-34), witness collection radius 8.5 (:598), retrieval `findSpeakerMemory` (`dialogueEngine.ts:124`) | `memories.test.ts` (witness radius/rain sheltering, provenance never downgrades, bounded capacity) | **None.** Bakery memory reuses the `participant` source-kind pattern (`activities.ts:226-283`) |
| Gossip | **Verified implemented** | `propagateEncounterGossipInPlace` (`memories.ts:779`) — affinity gate 20, tension gate 30, `MAX_GOSSIP_HOPS=2`, one per pair per day, seeded deterministic rolls; called from `simulation.ts:1040`; dialogue surfaces via `dialogue/everyday/gossip.ts` (7 topics) + third-party conditions (`dialogueEngine.ts:170,357`) | `memories.test.ts` ("gossip respects estrangement, pair cooldown, hop caps…"), `simulation.test.ts` Step 3.6, `dialogue.test.ts` Step 3.7 | **None.** LR2-13 pins that host-only shared-activity memories do not gossip — the bakery memory inherits the same protection |
| Storylines | **Verified implemented** (six storylines, not five) | `storylines.ts` — `STORYLINES` registry (:20): `side_pip_zine`, `side_herb_loaf`, `side_pond_stand`, `side_jun_watch`, `conflict_plaza_lanterns`, `side_orchard_gathering`; `advanceStorylineInPlace` (:686), `syncSideFlagsFromStorylineInPlace` (:643) | `storylines.test.ts` (branching, non-omniscience, cooldowns) | **None.** LR-3 needs no storyline; a Clara arc would be a pure 7th registry entry if ever wanted |
| Invitations | **Verified implemented** (LR-1) | `invitations.ts` — `isHostAvailableForActivity` (:59, 6 m home radius + exterior-encounter check), `isInvitationLive` (:85), `isInvitationExpired` (:119, strict D-03 predicate `!isInvitationLive`), `computeOfferWindow` (:127, D-17 contiguous-home cap), `canOfferInvitation` (:159, one-active-global + 2-day spacing + guarded + tier floor + availability), `offer/accept/decline/expire` (:209/:255/:284/:319), tick reconcile `expireInvitationsInPlace` (:384), day-advance `reconcileLivingRelationshipsOnDayAdvance` (:419) | `invitations.test.ts` (19 tests, LR1-01…LR1-19 incl. tick expiry), `lr-tick-load.test.ts` (LRTL-01…07 [PIN]), `storage.test.ts` (LR1-14/16/17/18 round-trips) | **None architectural.** Host is a record field; adding Clara is content. One test to add: `computeOfferWindow` for a host whose off-home phase is the afternoon (Clara), not Nora's morning pattern |
| Shared activities | **Verified implemented** (LR-2, one entry) | `activities.ts` — `SharedActivityDef` (:31), `SHARED_ACTIVITIES` registry (:52, single entry `share_featured_reading` → Nora/nook_interior/`nook_chair`), `applySharedActivityAffinity` (:87, +6/+2 bypasses smalltalk cap), `completeSharedActivity` (:161 — atomic: accepted-live invite + host + location + occupancy + encounter re-check + idempotency; grants journal memory + host-only NPC memory + `shared_activity` world event + archives invite) | `activities.test.ts` (LR2-05…LR2-13, H-1 drift refusal) | **Content.** Add the `share_morning_pastry` def; `completeSharedActivity` needs no change (H-1 completion re-check inherited from PR #5) |
| Occupancy / station exclusivity | **Verified implemented** (single venue) | `occupancy.ts` — `setOccupant` (:29), `clearOccupant` (:53), `getOccupantAt` (:70), `isStationOccupied` (:79), `NOOK_CHAIR_STATION_ID` (:19); single global slot `types.ts:787`; suppression patterns: `bookNook.ts:395` (armchair hidden), `actions.ts:3071-3093` (station card), `simulation.ts:653-656` (indoor resident skipped by tick) | `occupancy.test.ts` (LR2-01…04b, 15/16 load restore), `activities.test.ts` LR2-06 | **Architecture mirror + guards.** Port the enter hook to `enterBakeryAction`; add bakery station guards on `helpKneadDoughAction`/`shareMorningLoafAction`/`checkMorningBakeAction` |
| Social consequences | **Verified implemented** | Completion → +6/+2 affinity outside cap, host emotion, host-only memory, `worldEvents` row (`activities.ts:226-283`); reputation/readability via tier gates and `isResidentGuarded`; visible expiry/refusal lines (`invitations.ts:357-361`, `actions.ts:3004-3015`) | `activities.test.ts` LR2-09/10, `lr-tick-load.test.ts` NR-01 | **None.** Same consequence pipeline applies to Clara |
| Dialogue integration | **Verified implemented** | Declarative registry `dialogue/index.ts:41-64` (fixed order = compatibility contract), golden snapshot pinned by `dialogueRegistry.test.ts:44-93` (85 topics), category priorities (`invitation: 86`, `dialogueEngine.ts:38-49`), condition evaluator with invitation conditions (`requiresInvitationEligible` :473, `requiresActiveInvitation` :480 incl. `requireIndoors` occupancy match, `requiresTeachingKnown` :506), freshness scoring (:816-1047); per-host invitation modules `dialogue/invitations/nora.ts` (offer/pending/indoor/reminder quartet) | `dialogueRegistry.test.ts`, `dialogue.test.ts` (21), `build10-recovery.test.ts` BD10-10/11 | **Content + snapshot regen.** New `clara.ts` quartet; regenerate `scripts/dialogue-topics-golden.json` (85 → N) with documented justification |
| Persistence | **Verified implemented** (v11) | `migrations.ts:135` `CURRENT_SCHEMA_VERSION = 11`; sequential chain v1→v11 (§3 below); sanitize-on-load; save-revision fingerprint (`storage.ts:455`); `advanceToNextDay` ends with LR reconcile (`storage.ts:636`); pure-wrapper clone of LR slices (`simulation.ts:1092-1103`) | `storage.test.ts` (21 incl. pre-LR fixture probe that auto-adapts to future versions), per-venue migration pins | **Likely none.** New activity def is code, not save data; occupancy/invitations/teaching slices already exist. A v12 bump is required only if genuinely new persisted state emerges (doc 03 §2 decision D7) |
| Journal integration | **Verified implemented** | `journal.ts` — `PocketJournalView` (:167) with `activeInvitation` (:157-179) built registry-generically at (:1169-1186 [Reconciled `a80a220`: `:1183-1200`, `homeName` fallback `:1189`], uses `getSharedActivityDef` so a new activity appears with no journal code); `isNpcMemoryKnownToPlayer` player-knowledge boundary (:244); UI `JournalDrawer.tsx:261-285` | `journal.test.ts` (14, knowledge boundaries + venue discovery lifecycles) | **None required.** Optional bakery discovery card would follow the Build 7 pattern |

**Matrix verdict:** every capability LR-3 depends on is implemented with production code **and** regression coverage. No capability is partial or missing. LR-3 is a content-scale addition on top of the proven v11 contracts — the audit found no missing foundation.

## 3. Persistence & migration inventory

`CURRENT_SCHEMA_VERSION = 11` (`migrations.ts:137`; [Reconciled `a80a220`] unchanged by the reliability merge — no schema bump landed). Sequential chain (all in `migrations.ts`; [Reconciled `a80a220`] line numbers re-based — the reliability sanitizer work inserted ~150 lines before the chain, shifting it downward):

| Step | Function | Line | Adds |
|---|---|---|---|
| v1→v2 | `migrateV1ToV2` | 1732 | baseline sim slices (relations, runtime, events) |
| v2→v3 | `migrateV2ToV3` | 1773 | posture/seats/props/topicHistory/sideFlags |
| v3→v4 | `migrateV3ToV4` | 1791 | npcMemories (save-evidence-only hydration) |
| v4→v5 | `migrateV4ToV5` | 2050 | storylines from legacy flags |
| v5→v6 | `migrateV5ToV6` | 2068 | everyday life (playerLocation/inventory/cottageState/dailyActivities) |
| v6→v7 | `migrateV6ToV7` | 2105 | `greenhouseState` (Build 6) |
| v7→v8 | `migrateV7ToV8` | 2117 | `bakeryState` (Build 7) |
| v8→v9 | `migrateV8ToV9` | 2129 | `nookState` (Build 8) |
| v9→v10 | `migrateV9ToV10` | 2141 | `copperwheelState` (Build 9) |
| v10→v11 | `migrateV10ToV11` | 2154 | LR slices: `invitations`, `occupancy`, `teaching`, `activeActivity` |

Chained by `migrateWorldState` (:2165) + `sanitizeWorldState` pass; forward-version guard at :2230. `stepSimulation` clones every mutable slice including the four LR slices (`simulation.ts:1092-1103` [Reconciled `a80a220`: `:1106-1117`]); `computeWorldSaveRevision` covers occupancy/teaching mutations (`storage.ts:455`).

**[Reconciled `a80a220`] Chain line re-base:** v10→v11 `migrateV10ToV11` is now **:2401-2410**, chained at **:2473**; the sanitizer's LR block is **:1532-1844** (details in §6.1); `stepSimulation`'s LR-slice clone block is **simulation.ts:1106-1117** (a residents per-record clone was inserted at :1059-1072 by the reliability work; the tick path stays allocation-free); `computeWorldSaveRevision` remains `storage.ts:455`. Semantics of every chain step are unchanged — verified by the 528/528 suite.

**LR-3 implication:** if the bakery shared activity is expressed purely as a registry entry + occupancy/`activeActivity` (existing fields), **no migration is needed**. If LR-3 introduces genuinely new persisted state (e.g., per-host invitation counters beyond `lastOfferDayByHost`, or a persisted bakery-host memory flag), it becomes **v12** via `migrateV11ToV12` after :2163, plus sanitizer, save-revision, and pure-wrapper clone updates. Doc 14 §9 policy (`:256-267`) forbids hardcoding schema versions in gates; the storage test harness auto-adapts to a bumped version. Decision deferred to doc 03 §2 (D7).

## 4. Dependency graph

```
Build 6 (Greenhouse) → Build 7 (Bakery) → Build 8 (Book Nook) → Build 9 (Copperwheel)
                                                          │
                        LR-1 (invitation foundation, v10→v11)
                                                          │
                        LR-2 (nook occupancy + share_featured_reading)
                                                          │
              ┌───────────────────────────────────────────┤
              │  merged on main (PR #5 recovery): D-03 strict predicate,
              │  D-04/H-1 completion re-check, tick/load parity suite
              ▼
            LR-3 (bakery occupancy + share_morning_pastry)   ← THIS MILESTONE
              ▼
            LR-4 (teaching flag, one knowledge id)
              ▼
            LR-5 (Arthur / Copperwheel; Build-9 prerequisite already met)

Parallel prerequisite line (unmerged):
  feat/systemic-reliability @ b71bb3c — persistence contract, SR-7 stationId
  resolution, F-ENTER-1 shared-enter-path revisit, save-integrity suite,
  long-run harness  →  gates LR-3 implementation start (doc 01 §8)
```

## 5. Integration seams for LR-3 (verified against `962fb07`)

Ten concrete touchpoints, classified as **content** (registry/data/dialogue additions) or **architecture** (behavior mirrored or guarded):

| # | Seam | Location | Class | Note |
|---|---|---|---|---|
| 1 | Add `share_morning_pastry` to `SHARED_ACTIVITIES` | `activities.ts:52-72` | Content | hostId `clara`, location `bakery_interior`; every consumer (eligibility, sanitizer, journal) reads the registry generically |
| 2 | Bakery occupant constants beside `BAKERY_SEAT_SPOTS` | `bakery.ts:297-308` | Content | station/seat/approach/facing; station id decision deferred (doc 03 §2 D3) |
| 3 | Port the enter-reducer hook to `enterBakeryAction` | `actions.ts:2664-2688` (mirror of :2973-3016) | **Architecture** | expiry reconcile → live check → host availability → `setOccupant` + `activeActivity`; else visible `host_unavailable` expiry. Also closes the F-ENTER-1 asymmetry class on the bakery path |
| 4 | Station-interaction branch for the shared activity | `actions.ts:2709-2737` + actionType union (:167-187) | Content | pattern: nook_chair branch :3071-3093 |
| 5 | `share_morning_pastry` actionType handler → `completeSharedActivity` | `App.tsx:960-974` | Content | today the handler hardcodes `'share_featured_reading'` [Reconciled `a80a220`: `App.tsx:961-975`, handler logic unchanged] |
| 6 | Derive accept-toast venue from the activity def | `actions.ts:897-907` (hardcodes "inside Linden Book Nook") | **Architecture** (one line) | required so Nora and Clara toasts stay truthful |
| 7 | Clara invitation dialogue quartet + aggregator + golden snapshot | `dialogue/invitations/clara.ts` (new), `dialogue/invitations/index.ts:4-6`, `scripts/dialogue-topics-golden.json` (85 → N) | Content + snapshot regen | golden test fails otherwise — intentional compatibility contract |
| 8 | Bakery occupant rig + hit proxy + venue-aware walkDest | `NeighborhoodCanvas.tsx:922-939, 2062-2109, 1454-1472` | Architecture (scene-layer pattern copy) | sync block already resident-generic; rig/hit-proxy are not [Reconciled `a80a220`: the BUILD 03/04 merges shifted these regions to **:945-961 (rig construction), :1477-1502 (click routing incl. `NOOK_OCCUPANT_APPROACH_POS` at `occupancy.ts:21` and the `share_featured_reading` label switch), :2086-2137 (per-frame sync, incl. a BUILD-04 `emotionIntensity` reset at :2115-2118 that the D8 parameterization must carry); the pattern itself is unchanged] |
| 9 | Station exclusivity guards on bakery reducers | `actions.ts:2740-2934` (pattern: `browseBookshelfAction` :3112-3123) | **Architecture** | knead/share/bake suppressed or visibly refused while the station is occupied; the doc-13:91 same-minute co-fire hazard is the target |
| 10 | Occupant-aware target selection for the bakery | `bakery.ts:310-371` (mirror of `bookNook.ts:366-391`) | Content | `selectBestBakeryTarget` gains the occupant candidate branch |

Not in the list, deliberately: any change to `completeSharedActivity` (already generic, already carries the H-1 re-check), `canOfferInvitation` (already host-generic), journal (already registry-driven), tick loop (already skips `occupancy.residentId` generically), or day-advance reconcile (already host-agnostic).

## 6. Reliability-gate dependency audit

### 6.1 Reconciliation update — the four items on current main (2026-11-22)

**[Reconciled 2026-11-22 — gate RESOLVED]** The audit below was written while `feat/systemic-reliability` was unmerged. The gate has since resolved via doc 03 §5 path (a): PR #11 merged the initiative (merge `f1c2af4`), PR #12 recorded post-merge verification, and this reconciliation re-ran the suite first-hand (528/528 on `a80a220`). Status of the four items, on current main:

1. **F-ENTER-1 revisit condition fires exactly at LR-3.** Still true, and now formally recorded on main: `docs/architecture/systemic-reliability-integration/06-deferred-findings.md` carries the finding verbatim ("only `enterNookAction` reconciles invitation expiry on room entry; cottage/greenhouse/bakery/copperwheel enters do not … Revisit when: a second interior gains an invitation-gated activity") and delegates the investigation to the LR-3 design record. Doc 05 §9 owns it; the code facts it cites are re-verified in doc 01 §8.1(1).
2. **Persistence contract** — now a main contract: sanitizer classification/warnings (`migrations.ts:1532-1844`), tombstone-before-rewrite (`storage.ts:99-107`), save-path warning parity (AR-5, `storage.ts:45-62`), enforced by `save-integrity.test.ts` (37 cases). LR-3 adds no persisted state (D7), so the contract binds only as a guardrail.
3. **SR-7 stationId resolution** — shipped on main (`migrations.ts:1772-1773`; pinned by `save-integrity.test.ts` SR-7 fixture). "Once a second station id exists, the sanitizer rule becomes load-bearing" has happened exactly as predicted; doc 05 §12 / doc 06 LR3-34/LR3-81 updated accordingly.
4. **Save-integrity suite and long-run harness** — on main: `src/game/save-integrity.test.ts` (37 cases) and `scripts/longrun_stress.ts` (scenarios A–G) are part of the 528/528 baseline; LR-3 inherits them as its regression net.

Conclusions here that depend on the **unmerged** `feat/systemic-reliability` branch (`b71bb3c`) — full detail in doc 01 §8:

1. **F-ENTER-1 revisit condition fires exactly at LR-3.** The deferred finding states: "Revisit when: a second interior gains an invitation-gated activity (then the reconciliation should move to the shared enter path)." Seam #3 above is precisely that event. On unhardened main, mirroring `enterNookAction`'s block into `enterBakeryAction` duplicates the reconciliation (the pattern the finding says to avoid); the correct target design (doc 05) is a shared enter-reconcile helper adopted by both venues.
2. **Persistence contract** (branch docs 03 §2 / 06 §3–4; branch HANDOVER §18): any new persistent field must get deterministic sanitizer defaults, domain rules, classified warnings, and GUARD coverage. On main today, only the pre-branch sanitizer behavior exists (which main's own writers never violate — but LR-3 must not rely on that for new state).
3. **SR-7 stationId resolution** (branch-only): once a second station id exists, the branch's sanitizer rule `stationId === SHARED_ACTIVITIES[activityId].stationId` else clear+warn becomes load-bearing for bakery saves.
4. **Save-integrity suite** (branch `save-integrity.test.ts`, 33 tests) and **long-run harness** (`scripts/longrun_stress.ts`, scenarios A-G) are the regression net the branch adds; LR-3 on unhardened main would ship without them.

**Merge-surface analysis (verified):** the branch and main modify disjoint file sets — branch: `migrations.ts`, `storage.ts`, `journal.ts`, `storylines.ts`, `simulation.ts(+test)`; main since the common base `545e323`: `src/scene/*` (BUILD 02), CI files. `types.ts` is byte-identical across both. Expected textual conflicts: small, in five game files. No test-file overlap. A future merge also needs the branch's WORKLOG Entry 053 renumbered (main took 053 for BUILD 02; see WORKLOG Entry 054 note).

## 7. Risks and hazards for LR-3

| Risk | Evidence | Disposition |
|---|---|---|
| Same-minute knead/share co-fire with the shared activity (station exclusivity hole) | `13-adversarial-review.md:91`; `actions.ts:2783-2856` day-stamp reducers | Seam #9 guards; doc 03 acceptance includes the no-mutation test from doc 15:87 |
| Window-cap semantics differ per host (Nora's 719 cap is pattern-specific) | `computeOfferWindow` `invitations.ts:127-152`; D-17 policy (recovery doc 05 §3) | Doc 03 §2 D2: Clara's cap computed from her contiguous home phases; dedicated test |
| Golden-snapshot regeneration conceals unintended dialogue changes | `dialogueRegistry.test.ts:50-65` pins count/order | Regenerate only from the live registry with a written behavioral justification (HANDOVER §17 convention, WORKLOG 051) |
| Accept-toast names the wrong venue for Clara | `actions.ts:901` | Seam #6 one-line derivation fix |
| Journal memory cap headroom shrinks with each new static memory id | ≈58-row content ceiling vs `JOURNAL_MEMORY_CAP=96` (branch doc 05; cap enforcement branch-only) | Re-validate headroom at LR-3 QA; keep new ids static/bounded (J-1/J-3) **[Reconciled `a80a220`: the 96-row newest-first trim is now a main contract — enforced by the sanitizer and pinned by `save-integrity.test.ts` SR-1 ("world.memories is trimmed to JOURNAL_MEMORY_CAP newest-first with a warning"); the LR-3 QA obligation is unchanged]** |
| Scene-layer occupant rig copy drifts from Nora's as-built rig contract | `NeighborhoodCanvas.tsx:922-939, 2062-2109` | Doc 05 defines one venue-parameterized occupant-rig path instead of a second hardcode |
| Silent scope creep into teaching (the doc-10 trap) | `activities.ts:48-49` comment; doc 10:84-91 legacy expectations | Doc 03 §1 out-of-scope list; acceptance asserts `teaching.known` remains empty |

## 8. Audit verdict

1. **No foundation work is missing.** All eleven LR-3-relevant capabilities are implemented and regression-pinned on the verified `962fb07` baseline.
2. **LR-3 is content-scale** at the simulation layer (registry entry, enter-hook mirror, three station guards, dialogue quartet) plus two small architecture corrections (shared enter-reconcile path; venue-derived toast) and one scene-layer pattern copy.
3. **The only blocking dependency is organizational, not technical**: the reliability gate (doc 01 §8). Nothing in this audit found a technical reason LR-3 could not be designed, test-planned and implemented immediately after that gate resolves — and design/test-planning can proceed now.

**[Reconciled 2026-11-22]** 4. The organizational dependency has resolved (PR #11/#12; §6.1). The audit's technical verdict is re-affirmed on the integrated tree: no foundation work is missing at `a80a220`; LR-3 remains content-scale plus the two forced corrections; the 528/528 baseline includes the reliability regression net LR-3 inherits.
