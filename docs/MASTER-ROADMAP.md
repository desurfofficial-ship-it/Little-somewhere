# LITTLE SOMEWHERE — Master Product Roadmap

> **AUTHORITATIVE.** This is the single source of truth for the product vision, the six pillars, what the game is and is not, what is actually built, and the strategic order in which development continues. Every other document that touches product direction is SUPPORTING or HISTORICAL relative to this one (see §10 — Document Authority).

**Repository:** https://github.com/desurfofficial-ship-it/Little-somewhere
**Recorded:** 2026-11-23, atop `origin/main` @ `a765f38`.
**Audit basis:** full repository audit (codebase + tests + docs + git history) by three parallel specialists — see `docs/roadmap/REPOSITORY-ALIGNMENT-AUDIT.md` for the evidence.
**Live status snapshot:** `WorldState` **v12** · **722/722 tests** green · `tsc` clean · build green · 11-step migration chain.

---

## 1. Product vision

**LITTLE SOMEWHERE** is a cozy neighborhood life simulation. You move into a little neighborhood where everybody has a life of their own. You have a small home, a few belongings, and an unfamiliar neighborhood to discover.

There is no world-ending threat. No business competition. No multiplayer race. No pressure to become the richest or most successful person. You gradually become part of a community — you get to know the people around you, discover their stories, participate in everyday activities, build relationships, improve your surroundings, and create a place that feels like home.

**The neighborhood should feel alive even when the player is doing absolutely nothing.** The player should be able to sit on a bench and watch residents go about their day.

That is the experience we are building.

### The six core pillars

1. **A Living Neighborhood** — the neighborhood operates as a living environment, not a collection of static NPCs waiting for interaction. Residents wake, follow daily routines, visit destinations, work/shop/cook/garden/read/rest/socialize, have independent NPC↔NPC relationships, react to weather/time, and continue living when the player is absent.
2. **Everyday Activities** — gardening, fishing, decorating, cooking, sharing meals, photography, exploring, collecting, discovering, helping neighbors, community activities. Activities connect naturally to the world and its residents. Not grinding.
3. **Actual Resident Personalities** — every important resident is an individual with personality, preferences, schedules, interests, friendships, memories, stories, and meaningful dialogue. A relationship system represents lived experiences, not merely a numerical score.
4. **The Neighborhood Remembers** — the world visibly responds to the player's actions and residents' lives: trees grow, gardens restore, shops reopen, residents become friends, places improve. Changes persist. The player can look at a place and recognize that something changed because of events in the simulation.
5. **Seasons and Atmosphere** — morning/afternoon/evening/night, seasonal changes, weather, wildlife, ambient sound, lighting, seasonal resident behaviors, community celebrations. The world feels beautiful and peaceful even when the player is not completing an activity.
6. **No Stressful Progression** — no punishing login requirements, no real-world timers, no energy depletion, no artificial urgency, no grinding, no punishment for breaks, no competitive business progression, no systems that make players feel behind. **Reward returning to the neighborhood. Never punish leaving it.**

---

## 2. Product boundaries — what this game IS and IS NOT

### LITTLE SOMEWHERE IS
- A cozy neighborhood life simulation.
- A single-player-first experience.
- A character-driven social simulation.
- A living-world simulation.
- An exploration and everyday-life experience.
- A persistent neighborhood with meaningful consequences.
- A peaceful game centered on community, relationships, and personal expression.

### LITTLE SOMEWHERE IS NOT
- A business tycoon.
- A shop-management simulator.
- A farming grind game.
- A conventional quest checklist.
- A relationship-number grinding game.
- A competitive multiplayer game.
- A game driven by artificial real-world urgency.
- A game where NPCs exist only to give the player quests.

**Do not let future development drift toward these categories.** Business interiors, shops, workshops, and establishments are part of the neighborhood ecosystem — they are not an excuse to transform the project into a business-management game.

---

## 3. Current development status (executive summary)

The project is a genuinely playable, persistent cozy life-sim with a deterministic simulation, 10 named residents with daily routines and NPC↔NPC relationships, 5 visitable interiors, a branching dialogue engine (86 topics), a Pocket Journal, environmental reactivity, seasonal/weather systems, and `WorldState` v12 persistence with an 11-step migration chain.

**All six pillars are embodied.** The codebase is strikingly faithful to the original vision — the negative space (no business sim, no grinding, no multiplayer race, no NPC-quest-dispensers, no real-world timers) is robustly defended in `GAME_DESIGN.md` §2/§11, `AGENTS.md` §7 (product identity + the six pillars + the IS/IS-NOT list), and the living-relationships non-goals.

**Status classification** (per the directive — evidence in `docs/roadmap/REPOSITORY-ALIGNMENT-AUDIT.md`):

| Status | Meaning |
| :--- | :--- |
| **IMPLEMENTED** | Integrated and functioning, supported by evidence. |
| **PARTIALLY IMPLEMENTED** | Core foundations exist; meaningful functionality remains. |
| **IN DEVELOPMENT** | Active implementation with identifiable ownership. |
| **DESIGNED** | Requirements/design exist; implementation not present. |
| **PLANNED** | Accepted future work without completed design. |
| **DEFERRED** | Intentionally postponed. |
| **BLOCKED** | Cannot proceed due to an identified dependency. |
| **SUPERSEDED** | Replaced by a newer approved design/implementation. |

---

## 4. Completed milestones (authoritative)

All milestones below are **IMPLEMENTED** and merged to `main`, verified by the audit (code + tests + git history). Historical status claims were checked against the current repository before being listed here. Dialogue content: 86 topics across 23 modules.

| Milestone | What it delivered | Evidence |
| :--- | :--- | :--- |
| **Milestone 1** | Simulation foundation: deterministic tick, time/calendar, WorldState v1, first residents | `CHANGELOG.md`, `WORKLOG.md` early entries |
| **Milestone 2A** | Simulation foundation hardening | `docs/audits/01-current-simulation-audit.md` |
| **Milestone 2B** | Ambient neighborhood life (phases 1-5) | `docs/audits/02-npc-life-simulation-blueprint.md` |
| **Milestone 2C** | Character & experience polish (rounds 1-8) | `docs/production/everyday-life-polish-roadmap.md` (HISTORICAL); `HANDOVER.md §10-§15` |
| **Milestone 3 (Builds 1-9)** | Neighborhood & story expansion: 5 visitable interiors (Cottage, Greenhouse, Bakery, Book Nook, Copperwheel), Fern Hollow Orchard, 10 residents, dialogue modularization | `CHANGELOG.md [0.3.0]-[0.9.0]`; `docs/milestones/16-19` |
| **Build 10 — Wild Hollows** | Exterior exploration: Foxglove Rise, Old Stone Well, Sorrel Hollow, Marigold Lane, The Bee Line | `docs/design/20-build-10-wild-hollows-world-expansion.md`; recovered via `docs/architecture/build10-lr-recovery/` |
| **Dialogue Modularization** | 86 dialogue topics across 23 modules | `src/game/dialogue/index.ts:42` |
| **Systemic Reliability** | Save integrity, sanitizer, migration hardening, stress harness | `docs/architecture/systemic-reliability-integration/07-final-integration-audit.md`; PR #11 |
| **Living Relationships LR-1** | Invitation foundation (`WorldState` v11) | `invitations.ts`, `occupancy.ts`; `docs/architecture/living-relationships/` |
| **Living Relationships LR-2** | Linden Book Nook indoor occupancy + shared featured reading | `activities.ts:52` (`share_featured_reading`); `docs/architecture/living-relationships/22` |
| **Social Foundation SF-1..SF-4** | Derive-only social layer: `socialProfile`, `invitationFramework`, `emergentStories`, `dialogueContext` | `src/game/socialProfile.ts` etc.; `docs/architecture/social-foundation/`; commit `8b715fc` |
| **Character Quality CQ-1** | Expression, motion & presentation program | `src/scene/builders/characters.ts`; HANDOVER §21 |
| **Everyday Gameplay (GA-0..GA-6)** | Community Projects (3), greenhouse care streaks, Everyday Practice Profile (`WorldState` v12) | `src/game/community.ts`; `docs/architecture/everyday-gameplay/`; CHANGELOG `[0.11.0]` |
| **NPC Intelligence & Living Simulation** | Memory→behavior bridge, directional perception, social groups, friction, atrophy | `src/game/perceptions.ts`; `docs/architecture/npc-intelligence-living-simulation/`; PR #23 |
| **World-Quality Overhaul** | Camera system, fountain reconstruction, furniture quality, occlusion, room framing | `src/scene/cameraController.ts`, `occlusion.ts`, `roomFraming.ts`; `docs/proposals/2026-11-22-world-quality-overhaul/` |
| **Visual Identity Build 04** | Life in motion (talk mouth-flap, two-segment arms, ambient sway, token discipline) | `docs/art-direction/visual-identity-evolution/`; PR #10 |
| **Rendering Integrity** | Floor-flicker elimination (unified cobble network, truthful ground contract) | `src/scene/builders/cobbleNetwork.ts`; commit `f4590ea`; WORKLOG Entry 071 |
| **Whisper-bubble reposition** | Nearby neighbor whisper moved from mid-screen to bottom (unblocks scene focal point) | `src/App.tsx`; PR #24 |
| **Master Architecture Governance** | Ownership matrix, contracts, parallel-dev protocol, CI gates, operating directive | `docs/architecture/master-architecture/00-10`; PRs #14, #18 |

---

## 5. Current milestone — LR-3 (Clara's Morning Pastry Invitation)

**Status: IMPLEMENTED + LOCALLY VERIFIED — pending review/merge, browser QA, and independent adversarial sign-off (see the execution record below).**

> **[Execution record — 2026-11-24]** The five clearance items below were executed on the `docs/lr3-implementation-proposal` → `fix/qa03-cross-venue-sit` → `feat/bakery-spatial-comfort` → `feat/lr3-slice-1` → `feat/lr3-slice-2` branch series (PRs #26–#30, fast-forward only):
> 1. **Implementation landed** — `share_morning_pastry` def + Clara quartet + golden 86→90 (slice 1); `reconcileInvitedInteriorEntry` shared enter helper + bakery reducers + S3 station guards + scene D8 + dual-surface completion (slice 2). 802/802 tests green (738 pre-existing unmodified + 6 QA-03 + 10 spatial + 19 slice-1 battery + 29 slice-2 battery), `tsc` clean, build green.
> 2. **QA-02 verification basis** — golden math corrected to 86→90 (QA-05) with committed justification; as-built corrections recorded in-battery for LR3-11 (719-flat window) and LR3-96 (OR-reading floor, QA-08); the doc re-base pass for the remaining v12 anchor drift is the standing docs obligation (non-blocking).
> 3. **QA-03 FIXED** — categorical cross-venue sit guard (`seatLocation(seat) !== world.playerLocation`) with the full adversarial battery; probe P5d flipped.
> 4. **QA-10 CLOSED as NOT-REPRODUCIBLE** — three artifact-immune methods prove `branches: [main]` intact (`lr3-qa10-correction.md`); the register entry was an environment display artifact.
> 5. **11-field proposal FILED** — `docs/architecture/lr3/10-implementation-proposal-11-field.md` (PR #26), with architecture + adversarial review verdicts recorded, filed before any feature code per the governance precondition.
>
> State classification (honest register): **Implemented locally / Locally tested** (unit + battery + build on the branch tips). NOT yet: **Merged**, **Remotely CI-verified on the PRs**, **Browser-verified** (desktop/mobile manual QA per doc 06 §11 item 5), or **Independently reviewed** (the post-implementation adversarial re-run of probes P4/P5a/P8 is scripted in the QA-03 battery; the review itself is scheduled). Acceptance therefore remains **pending** until merge + those gates — do not mark the milestone ACCEPTED on the strength of this record alone.

The original clearance list is preserved below for the audit trail. The LR-3 design verdict is READY, and `docs/architecture/lr3-qa/lr3-integration-readiness.md` recorded **5 explicit blockers** that had to clear before implementation could begin:

1. **LR-3 implementation absent** (start-gate) — no `share_morning_pastry` in `SHARED_ACTIVITIES`, no `feat/lr3-implementation` branch.
2. **QA-02 stale verification basis** — the LR-3 design docs (`docs/architecture/lr3/01-09`) were reconciled against v11; they need a re-base pass onto v12 (anchor drift, golden math 86→90, file-map gaps) before an implementer reads them as current.
3. **QA-03 cross-venue sit teleport** (latent current-code bug) — a platform defect that LR-3's bakery seat surface would expose. Must be fixed or explicitly waived BEFORE the LR-3 branch exposes the bakery seat.
4. **QA-10 `ci.yml` push trigger corrupted** — post-merge push CI doesn't run (PR-trigger CI already covers the implementation PR). One-line fix.
5. **11-field implementation proposal** (`docs/architecture/master-architecture/03` §8) must be filed before LR-3 code — governance precondition.

The campaign found **no defect in the chassis that would force a redesign**; the design's load-bearing claims survived re-derivation. These are clearance items, not design problems.

**Owner:** LR team (per `docs/architecture/master-architecture/04-module-ownership-matrix.md` §1 + `10-operating-directive.md` §8). The central coordinator authorized the main agent as LR team / LR-3 owner on 2026-11-22.

**What LR-3 is** (authoritative spec: `docs/architecture/lr3/01-authoritative-milestone-discovery.md` §3-§5, `03-lr3-scope-and-acceptance.md`):
- Host: **Clara** (Hearth & Crumb Bakery).
- Activity: **`share_morning_pastry`** — a meaningful shared social experience.
- Bakery interior occupancy (the invitation chassis + occupancy system already support this).
- Appropriate dialogue and relationship context.
- Persistent outcomes.
- A complete, playable shared social experience.

**What is already built for LR-3** (verified by audit):
- The invitation chassis (`invitations.ts`: offer/accept/decline/expire) — IMPLEMENTED.
- The occupancy system (`occupancy.ts`) — IMPLEMENTED.
- The bakery interior (bounds, stations, interactables, builder) — IMPLEMENTED.
- Clara's schedule, traits, dialogue — IMPLEMENTED.
- The `invitationFramework.ts` reservation comment (`invitationFramework.ts:47` names `share_morning_pastry` as reserved).

**What is NOT built** (the LR-3 implementation gap):
- `share_morning_pastry` is **not defined** in `SHARED_ACTIVITIES` (`activities.ts:52` has exactly 1 entry: `share_featured_reading`).
- No `share_morning_pastry` activity reducer, no bakery station guards for the invitation, no Clara invitation dialogue tree, no golden snapshot.
- No `feat/lr3-implementation` branch exists (verified via `git branch -a`).

**Boundaries (directive §8 + design decisions):**
- LR-3 is **Bakery + Clara only** — not the five-venue adoption that was rejected in adversarial review.
- LR-4 (teaching) is **excluded** from LR-3.
- LR-5 (Arthur/Copperwheel) is **excluded** from LR-3.
- **No schema bump** for LR-3 (D7 registry-only policy; LR-3 must not touch `migrations.ts`/`storage.ts`).
- D10 (`offerPhases: ['morning']`) is **owner-approved** (recorded in `docs/architecture/systemic-reliability-integration/08-lr3-d10-owner-decision-record.md`).
- The reliability integration gate is **resolved** (PR #11 merged via path (a)).

**Do not duplicate LR-3.** Other teams coordinate with the LR team; do not create a competing implementation, branch, or proposal (directive §8 / `docs/architecture/master-architecture/10-operating-directive.md` §8).

---

## 6. Remaining work — organized by the six pillars

### Pillar 1 — A Living Neighborhood
| Item | Status | Evidence / next |
| :--- | :--- | :--- |
| NPC Intelligence Evolution Tier 1-3 (G1-G9 gaps) | IN DEVELOPMENT | `docs/architecture/npc-intelligence-evolution.md`; branch `feat/npc-intelligence-evolution` |
| More memorable residents (beyond 10) | PLANNED | Current cast is a foundation, not a cap (`RESIDENT_ORDER` scales) |
| Multi-district `REGIONS` expansion | PLANNED | `worldMap.ts:48 DEFAULT_REGION_ID='willow_square'`; only one region |
| Spontaneous resident-to-resident interactions | PARTIALLY IMPLEMENTED | Encounters + gossip fire; more variety desired |
| Independent resident activities (no player needed) | IMPLEMENTED | `simulation.ts:402 selectActivityForResident`; autonomous |

### Pillar 2 — Everyday Activities (the most underrepresented pillar)
| Item | Status | Evidence / next |
| :--- | :--- | :--- |
| **Gardening** (full pillar) | PARTIALLY IMPLEMENTED | Greenhouse-only (4 plots, 4 crops). Cottage window boxes, outdoor soil beds, orchard tending — DESIGNED. **Next milestone candidate** (highest readiness + most underrepresented). |
| **Fishing** | IMPLEMENTED | Willow Jetty (Stage 3) + West Brook Bank (v1.1, multi-spot `FISHING_SPOTS` registry). `src/game/fishing.ts`. One cast/day, zero-migration, deterministic. |
| **Photography** | IMPLEMENTED | Stage 3 Continuation. `src/game/photography.ts` (reducer + 13-subject registry) + `src/components/PhotoPanel.tsx` (viewfinder + album). Zero schema bump; first-of-subject journal memories + `framed_photo_keepsake` + `'photo'` witness dialogue echoes. No day-gate, no quota. |
| **Decorating** (full pillar) | PARTIALLY IMPLEMENTED | Vase flowers + 5-slot keepsake shelf only. Furniture arrangement, wall placement, porch decorating — DESIGNED. |
| **Cooking & shared meals** | PARTIALLY IMPLEMENTED | Hearth baking + tea brewing + bakery help exist. Recipe discovery, teachable exchange (LR-4), shared cooking — PLANNED. |
| **Exploration & discoveries** | IMPLEMENTED | 4 wild destinations + journal discoveries |
| **Collectibles** | PARTIALLY IMPLEMENTED | Satchel (34 items incl. 5 pond catches + 3 community keepsakes + framed photo); photo album implemented (Photography); no general collection album |
| **Community activities** | IMPLEMENTED | 3 Community Projects (contribute + social consequences + keepsake rewards). Keepsake physical display complete (Stage 3 Continuation: 3 bespoke meshes + unified shelf map). No cooperative building phase. |
| **Sunday Market** | PLANNED | `GAME_DESIGN.md:211`. Cadence UNDECIDED. Zero implementation. |
| **Seasonal Festivals** | PLANNED | `GAME_DESIGN.md:214`. No design doc. |

### Pillar 3 — Actual Resident Personalities
| Item | Status | Evidence / next |
| :--- | :--- | :--- |
| 10 named residents with traits/schedules/needs/emotions | IMPLEMENTED | `residents.ts` |
| NPC↔NPC relationships (affinity/tension/familiarity) | IMPLEMENTED | `relationships.ts` |
| NPC memories (firsthand + gossip, capped) | IMPLEMENTED | `memories.ts` |
| Memory→behavior bridge | IMPLEMENTED | `simulation.ts:343` (PR #23) |
| Directional perception + social groups + atrophy | IMPLEMENTED | `perceptions.ts` (PR #23) |
| **LR-3 invitation (Clara)** | DESIGNED — current milestone | See §5 |
| **LR-4 Teaching & shared hobbies** | DESIGNED | `docs/architecture/living-relationships/23-lr4-teaching-specification.md` |
| **LR-5 Arthur/Copperwheel hosting** | DESIGNED | `docs/architecture/living-relationships/24-lr5-arthur-copperwheel-specification.md` |
| Tier-gated invitations across remaining hosts (Barnaby, Sora, Toby) | PLANNED | Post-LR-5 |
| Per-NPC memory-driven dialogue topics | PARTIALLY IMPLEMENTED | Engine supports `requiresNpcMemory`; more content desired |
| Deeper personal side arcs | PARTIALLY IMPLEMENTED | 6 storylines shipped; more desired |

### Pillar 4 — The Neighborhood Remembers
| Item | Status | Evidence / next |
| :--- | :--- | :--- |
| Environmental reactivity (blooming sills, restored fountain, cleared ivy, lit festoons, café tables, bell) | IMPLEMENTED | `narrative.ts:computeEnvironmentState`; `environmentRenderer.ts` |
| Community Projects (3 permanent flags) | IMPLEMENTED | `community.ts`; `sideFlags[worldFlag]` |
| Community Project **visible rewards** (plaza garland, orchard lanterns, pond mosaic scene rendering) | PARTIALLY IMPLEMENTED | Flags persisted; scene rendering is open backlog (World team) |
| Per-NPC memories persist | IMPLEMENTED | `npcMemories` (v4) |
| Storyline persistence | IMPLEMENTED | `storylines` (v5) |
| Home/greenhouse/bakery/nook/copperwheel state | IMPLEMENTED | v6-v10 |
| Cross-district growth | PLANNED | `REGIONS` expansion; long-term |

### Pillar 5 — Seasons and Atmosphere
| Item | Status | Evidence / next |
| :--- | :--- | :--- |
| 4 time phases (morning/afternoon/golden/dusk) | IMPLEMENTED | `time.ts:16` |
| 4 seasons (10-day each, 40-day cycle) | IMPLEMENTED | `time.ts:7` |
| 4 weather types (sunlit/breezy/misty_morning/light_rain) | PARTIALLY IMPLEMENTED | No heavy rain, snow, storms; snow not modeled even in winter |
| Lighting cycle | IMPLEMENTED | `environmentRenderer.ts` |
| Procedural audio (12 SFX) | IMPLEMENTED | `audio.ts` |
| Wildlife (butterflies, skep bees) | PARTIALLY IMPLEMENTED | Orchard only; no koi/dragonflies/fireflies as agents (prose mentions exist) |
| Seasonal NPC behaviors | PARTIALLY IMPLEMENTED | Weather-aware traits; more seasonal routines desired |
| Seasonal decorations / porch life | IMPLEMENTED | `builders/porchSeasonLife.ts`; seasonal interior dressing |
| Festivals & community celebrations | PLANNED | No design doc |

### Pillar 6 — No Stressful Progression
| Item | Status | Evidence / next |
| :--- | :--- | :--- |
| Currency-free, anti-grind identity | IMPLEMENTED & DEFENDED | `GAME_DESIGN.md:24,29,255-264` |
| No real-world timers for progression | IMPLEMENTED & DEFENDED | Simulation-time governs all progression; `Date.now()`-free sim |
| No energy depletion / no punishment for breaks | IMPLEMENTED & DEFENDED | `GAME_DESIGN.md:262-264` |
| Reward returning, never punish leaving | IMPLEMENTED | Day-rollover welcomes; no missed-day penalties |
| **Maintain across all future work** | ONGOING DISCIPLINE | Every future feature must honor this pillar; specific future violation surfaces to watch: Community Projects contribution-grind (Stage 2), Gardening watering-grind (Stage 3), Sunday Market FOMO risk (Stage 5) |

---

## 7. Deferred features (explicitly)

| Feature | Status | Rationale |
| :--- | :--- | :--- |
| **Multiplayer** | DEFERRED | Single-player-first. Multiplayer is a potential future expansion requiring a separate approval + architecture decision. Do not build multiplayer infrastructure prematurely. |
| **Cross-device Cloud Saves** | DEFERRED (long-term) | Always 100% optional, never gating offline. `localStorage` is the current persistence. |
| **New connected districts** | DEFERRED (long-term) | `REGIONS` expansion; only after core neighborhood is sufficiently mature. |
| **Pets** | DEFERRED (long-term) | `GAME_DESIGN.md:341` "LONG-TERM VISION." |
| **LayaAir engine migration** | SUPERSEDED (rejected) | `docs/architecture/layaair-reference/10-final-engineering-assessment.md` — reference only; not adopted. |

---

## 8. Strategic development sequence (6 stages)

This is the **recommended strategic direction**, subject to the actual state of the repository and existing approved specifications. The active milestone must have clear acceptance criteria, dependencies, ownership, and approved scope. This sequence is NOT authorization to start all stages simultaneously.

### Stage 1 (CURRENT) — Finish Living Relationships
1. **LR-3**: Clara's Morning Pastry Invitation (Bakery + `share_morning_pastry`). — DESIGNED, gated on 5 clearance items (§5).
2. **LR-4**: Teaching and Shared Hobbies. — DESIGNED; do not invent final requirements without checking `docs/architecture/living-relationships/23`.
3. **LR-5**: Arthur and Copperwheel. — DESIGNED; see `docs/architecture/living-relationships/24`.

**Goal:** develop relationships through meaningful shared experiences, not by adding dialogue or increasing scores.

### Stage 2 — Community Projects
Build upon the existing Sorrel well-garden pilot + the 3 shipped Community Projects (GA-1).
- Resident contributions.
- Collaborative improvement.
- Persistent environmental changes (the visible rewards — plaza garland, orchard lanterns, pond mosaic — are open backlog for the World team).
- Relationship-influenced participation.
- Community activities.
- Long-term neighborhood development.

Community progression must remain believable and day-driven.

### Stage 3 — Everyday Activity Expansion
Prioritize meaningful, integrated gameplay for (one at a time, not simultaneously):
1. **Gardening** (expand beyond greenhouse: window boxes, outdoor beds, orchard tending) — **NEXT**.
2. ~~**Fishing**~~ — SHIPPED (Willow Jetty + West Brook Bank).
3. ~~**Photography**~~ — SHIPPED (Stage 3 Continuation; see `docs/architecture/stage3-everyday-activities/05-photography-design.md`).
4. **Home decorating** (furniture placement, wall placement, porch).
5. **Cooking and shared meals** (recipe discovery, shared cooking).
6. **Exploration and discoveries** (expand the Wild Hollows).

**Next milestone recommendation: Gardening expansion** (window boxes, outdoor soil beds, orchard tending). Rationale: the most underrepresented pillar (Pillar 2 header); highest readiness (the greenhouse plot/reducer pattern extends directly to window boxes and outdoor beds); lowest risk (no new architecture, no schema movement, reuses the everyday-practice + inventory + witnessing patterns); strengthens the core everyday-activities loop without adding a disconnected mechanic. NPC participation in activities remains deferred pending simulation-owner coordination (do not build a second simulation framework).

Each activity must have a meaningful place in the neighborhood simulation. Do not turn these into repetitive grinding systems.

### Stage 4 — Living World Expansion
- NPC autonomy deepening (NPC Intelligence Evolution Tier 1-3, G1-G9).
- More spontaneous resident-to-resident interactions.
- Resident personal stories (deeper side arcs).
- Population variety (more memorable residents — quality over count).
- Environmental reactions to time passage.
- Community events.
- Resident-to-resident relationships (more variety).

Prioritize simulation quality and believable behavior over simply increasing NPC count.

### Stage 5 — Seasons and Personal Expression
- Seasonal activities.
- Festivals and community celebrations.
- Weather-dependent behaviors (snow, heavy rain, storms).
- Home customization (full decorating pillar).
- Pets (long-term).
- Seasonal decorations.
- Personal collections and displays (photo album, collection album).
- Additional neighborhood experiences (Sunday Market — cadence decision needed).

### Stage 6 — Long-Term Expansion (only after core is sufficiently mature)
- Additional neighborhoods / connected districts (`REGIONS`).
- Larger resident populations.
- Expanded storylines.
- More complex community systems.
- **Optional multiplayer visits** — requires a separate approval and architecture decision. Remains deferred until single-player is sufficiently mature.

---

## 9. Development and technical principles

1. **Single-player comes first.** The single-player experience must be genuinely enjoyable and complete before multiplayer is considered. Do not build multiplayer infrastructure prematurely.
2. **Simulation time governs progression.** All meaningful progression is driven by the in-game clock and calendar. Never make major neighborhood or business growth depend on real-world days. No real-world waiting mechanics.
3. **Existing architecture is respected.** Preserve React, TypeScript, Three.js, Vite, the simulation architecture, save/persistence, NPC intelligence, and relationship systems. Do not replace without a demonstrated technical reason + explicit approval. Before proposing a new system, inspect whether an equivalent exists.
4. **Quality before feature count.** The game should become deeper, more coherent, more enjoyable — not simply larger. Fix existing defects before starting unrelated feature builds.
5. **Agent coordination.** One authoritative development status (this roadmap + `HANDOVER.md` live state + `docs/architecture/master-architecture/` governance). Parallel work has clear ownership (doc 04) and integration contracts (doc 06).

---

## 10. Document authority (governance structure)

This section establishes which documents are authoritative for what. See `docs/roadmap/REPOSITORY-ALIGNMENT-AUDIT.md` §1 for the full inventory + the reconciliation of stale claims.

| Document | Authority | Scope |
| :--- | :--- | :--- |
| **`docs/MASTER-ROADMAP.md`** (this file) | **AUTHORITATIVE — strategic product** | Product vision, six pillars, product boundaries, implementation status, milestone sequence, deferred features. |
| `HANDOVER.md` | AUTHORITATIVE — current technical state | Live status, current milestone, contracts, open backlog. Cross-links here for "what's next." |
| `GAME_DESIGN.md` | AUTHORITATIVE — mechanics | 12-section GDD: pillars elaborated, daily rhythm, residents, locations, dialogue, reward philosophy. |
| `AGENTS.md` | AUTHORITATIVE — engineering rules | Layer boundaries, visual constitution, verification gates, the 21 mandatory rules (§7). |
| `ARCHITECTURE.md` | AUTHORITATIVE — system mechanics | Layers, camera math, reactivity pipeline, file map. |
| `docs/architecture/master-architecture/00-10` | AUTHORITATIVE — engineering governance | Ownership matrix, contracts, parallel-dev protocol, integration gates, operating directive. **Complementary to this roadmap** — master-architecture = "how teams evolve mechanics in parallel"; this roadmap = "what the product is and where it's going." |
| `docs/architecture/{living-relationships,build10-lr-recovery,systemic-reliability{,-integration},social-foundation,everyday-gameplay,npc-intelligence-living-simulation,lr3,lr3-qa}` | SUPPORTING — feature-scoped | Per-initiative design + as-built records. |
| `docs/milestones/`, `docs/audits/`, `docs/research/`, `docs/proposals/`, `docs/production/`, `docs/visual-quality/` | HISTORICAL | Dated records, append-only. Tagged `STATUS: HISTORICAL` where not already. |
| `CHANGELOG.md` + `WORKLOG.md` + `git tag build-<sha>` | AUTHORITATIVE — release record | Per `docs/architecture/master-architecture/08` §9. |

**No competing roadmap authority.** The 9+ documents that previously carried "roadmap" in their filename are now SUPPORTING/HISTORICAL relative to this file (see `docs/roadmap/REPOSITORY-ALIGNMENT-AUDIT.md` §2 for the list + their new status).

---

## 11. Mandatory agent rules (governance)

Every coding agent must understand these rules. They are mirrored in `AGENTS.md` §7 and `docs/architecture/master-architecture/10-operating-directive.md`.

1. Read this master roadmap before beginning a new feature.
2. Inspect the existing implementation before designing a replacement.
3. Identify existing owners and active branches before touching a system (doc 04 §1).
4. Never duplicate an existing system without a documented reason.
5. Do not implement deferred features (§7) without approval.
6. Preserve the original cozy neighborhood identity (§1-§2).
7. Do not introduce real-world progression timers.
8. Keep the simulation driven by in-game time.
9. Preserve save compatibility and implement safe migrations when required (doc 07 §2 schema-bump protocol).
10. Fix relevant existing bugs before adding unrelated features.
11. Use clear integration contracts for parallel agents (doc 06).
12. Provide evidence for implementation claims.
13. Run relevant tests, typecheck, and production build (doc 08 §2 gates).
14. Verify gameplay behavior where applicable.
15. Update the appropriate documentation after completing work.
16. Report incomplete work honestly.
17. Do not mark work complete before integration and verification (use the 6-state vocabulary: doc 07 §6).
18. **Subagents may not launch further subagents** (directive §1) — the lead owns synthesis.
19. **File an 11-field implementation proposal** (doc 03 §8) before any substantial feature; lead + neighbor-team review required (directive §3).
20. **Every major implementation receives independent adversarial review** (directive §5, doc 08 §2) — reviewers actively attempt to disprove correctness; reproducible findings must be addressed.
21. **Maintain a consolidated team report** per merge cycle (directive §7, doc 07 §11).

**Feature authorization:** agents distinguish between Approved active work, Approved future work, Proposed ideas, and Deferred work. A feature appearing in the original vision does NOT automatically authorize an agent to implement it immediately. The active milestone (§5: LR-3) and its scope govern execution.

---

## 12. Final

LITTLE SOMEWHERE must remain LITTLE SOMEWHERE. The goal is not to build the largest possible neighborhood or accumulate the most features. The goal is to build a neighborhood that feels like somewhere people genuinely live — a place where residents have their own lives, where relationships develop naturally, where ordinary activities become memorable experiences, where the environment remembers what happened, and where the player gradually feels that they belong.

**Preserve the vision. Respect the existing implementation. Establish one authoritative roadmap. Make the next development steps unmistakably clear.**
