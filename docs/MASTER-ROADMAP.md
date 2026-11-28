# LITTLE SOMEWHERE — Master Product Roadmap

> **AUTHORITATIVE.** This is the single source of truth for the product vision, the six pillars, what the game is and is not, what is actually built, and the strategic order in which development continues. Every other document that touches product direction is SUPPORTING or HISTORICAL relative to this one (see §10 — Document Authority).

**Repository:** https://github.com/desurfofficial-ship-it/Little-somewhere
**Recorded:** 2026-11-23 (last revised 2026-11-25, atop `origin/main` @ `4893d56` — PR #37 merged).
**Audit basis:** full repository audit (codebase + tests + docs + git history) by three parallel specialists — see `docs/roadmap/REPOSITORY-ALIGNMENT-AUDIT.md` for the evidence.
**Live status snapshot:** `WorldState` **v12** · **991/991 tests** green · `tsc` clean · build green · 11-step migration chain · 95 dialogue topics · PR #37 merged (Fishing v1.1 + Photography + Community keepsake display).

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

> **Strategic pillar (long-term):** beyond the six core pillars, the game aspires to a **lifelong, narrative-driven, multi-district world** — see §12 (Storytelling, Narrative Progression & Lifelong World Expansion) and `docs/architecture/lifelong-narrative/00-LIFELONG-NARRATIVE-VISION.md`. This is a PROPOSED strategic direction, not an implementation authorization, and never overrides Pillar 6.

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

The project is a genuinely playable, persistent cozy life-sim with a deterministic simulation, 10 named residents with daily routines and NPC↔NPC relationships, 5 visitable interiors, resident gardens (cottage window boxes, outdoor soil beds, orchard tending), multi-spot fishing, photography, recipe-discovery cooking, a branching dialogue engine (105 topics across 28 modules), a Pocket Journal, environmental reactivity, seasonal/weather systems, procedural audio (room-tones, weather beds, foley, UI, page-turn), and `WorldState` v13 persistence.

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

All milestones below are **IMPLEMENTED** and merged to `main`, verified by the audit (code + tests + git history). Historical status claims were checked against the current repository before being listed here. Dialogue content: 105 topics across 28 modules (reconciled 2026-11-28).

| Milestone | What it delivered | Evidence |
| :--- | :--- | :--- |
| **Milestone 1** | Simulation foundation: deterministic tick, time/calendar, WorldState v1, first residents | `CHANGELOG.md`, `WORKLOG.md` early entries |
| **Milestone 2A** | Simulation foundation hardening | `docs/audits/01-current-simulation-audit.md` |
| **Milestone 2B** | Ambient neighborhood life (phases 1-5) | `docs/audits/02-npc-life-simulation-blueprint.md` |
| **Milestone 2C** | Character & experience polish (rounds 1-8) | `docs/production/everyday-life-polish-roadmap.md` (HISTORICAL); `HANDOVER.md §10-§15` |
| **Milestone 3 (Builds 1-9)** | Neighborhood & story expansion: 5 visitable interiors (Cottage, Greenhouse, Bakery, Book Nook, Copperwheel), Fern Hollow Orchard, 10 residents, dialogue modularization | `CHANGELOG.md [0.3.0]-[0.9.0]`; `docs/milestones/16-19` |
| **Build 10 — Wild Hollows** | Exterior exploration: Foxglove Rise, Old Stone Well, Sorrel Hollow, Marigold Lane, The Bee Line | `docs/design/20-build-10-wild-hollows-world-expansion.md`; recovered via `docs/architecture/build10-lr-recovery/` |
| **Dialogue Modularization** | 95 dialogue topics across 25 modules | `src/game/dialogue/index.ts:42` |
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
| **Living Relationships LR-3** | Clara's Morning Pastry Invitation: `share_morning_pastry`, bakery interior occupancy, invitation dialogue quartet, restday eligibility gate | Merged via PR #45 (stacked slice series PRs #26–#30); `src/game/activities.ts`, `src/game/lr3-restday-gate.test.ts` |
| **Living Relationships LR-4** | Nora teaching & shared hobbies: `teaching.known` (v13 sanitize), `knowledgeGranted` chassis, `teaching_nora_featured_reading` follow-up | commit `4acf2f3`; `docs/architecture/living-relationships/23,25` |
| **Living Relationships LR-5** | Arthur Copperwheel Workshop hosting: `share_workbench_hour`, `arthur_escapement_basics`, bench station occupancy + occupant rig | PR #46; `docs/architecture/living-relationships/24,26` |
| **Gardening Expansion** | Beyond-greenhouse gardening: cottage window boxes, outdoor soil beds, orchard tending (`gardens.ts`, GardenPanel) | PR #40; `docs/architecture/gardening-expansion-contract.md` |
| **Resident Gardens hardening & social integration** | Activation tuning, planting/harvest ownership guards, everyday-practice filter, garden social layer | PRs #42 (review), #44 (social integration), #47 (critical fixes) |
| **Recipe Discovery** | Ingredient-gated cooking unlocks, first-cook memories, kitchen practice integration | PR #43 |
| **Fishing v11 — West Brook Bank** | Multi-spot `FISHING_SPOTS` registry (Willow Jetty + West Brook Bank), fishing-photo keepsakes | PRs #37, #38 |
| **Photography** | 13-subject registry, viewfinder + album, framed-photo keepsake, `'photo'` witness echoes | `src/game/photography.ts`, `src/components/PhotoPanel.tsx` |
| **Community Projects Advance** | Contribution progression, keepsake rewards, visible reward rigs (garland/lanterns/mosaic) | PR #41; `src/scene/builders/plazaGarland.ts`, `orchardLanterns.ts`, `pondMosaic.ts` |
| **Everyday-Activity Social Integration** | Everyday activities feeding relationships/dialogue (`fishingEcho`, `gardenEcho`, photo echoes) | PR #49 |
| **Earshot skill exercise** | Procedural page-turn foley for the Book Nook shelf browse (zero shipped audio assets) | PR #50; WORKLOG Entry 073 |
| **Dream Loop visual improvements** | Balanced bridge lanterns on the Mirror Pond footbridge (mirrored iron buffer, shared lantern glass) | PR #51 |

---

## 5. Status reconciliation (2026-11-28) & next milestone recommendation

> **[Reconciliation record — 2026-11-28]** This section replaces the prior "Current milestone — LR-3" text, which still described LR-3 as pending review/merge. Since that record was written, the repository shipped (all merged to `main`, CI green, independently re-verified during this reconciliation): LR-3 (PR #45, stacked slice series #26–#30), LR-4 teaching (commit `4acf2f3`), LR-5 (PR #46), gardening expansion (PR #40) + resident-gardens hardening (PRs #42, #44, #47), recipe discovery (PR #43), community-projects advance + visible reward rigs (PR #41), everyday-activity social integration (PR #49), the earshot page-turn foley (PR #50), and the Dream Loop bridge lanterns (PR #51). The full ledger is in §4; the historical LR-3 clearance list and execution record remain in git history.

**Stage status after reconciliation:**

- **Stage 1 — Finish Living Relationships: COMPLETE.** LR-3 (Clara), LR-4 (Nora teaching), LR-5 (Arthur Copperwheel) are all IMPLEMENTED. The invitation chassis (`invitationFramework`, station occupancy, offer phases, `knowledgeGranted`, teaching follow-ups) has proven itself across three hosts with **zero schema movement** (registry-only policy D7 held; `WorldState` v13).
- **Stage 2 — Community Projects: core loop COMPLETE.** Contribution progression + keepsake rewards (PR #41), visible reward rigs (plaza garland / orchard lanterns / pond mosaic — `NeighborhoodCanvas.tsx:946-954`, `environmentRenderer.ts` progressive stages), relationship-influenced participation and social consequences (PRs #44, #49). Open remainder: a cooperative building phase (no design doc; not scheduled).
- **Stage 3 — Everyday Activity Expansion: largely shipped.** Gardening expansion, fishing, photography, recipe discovery, and everyday-activity social integration are IMPLEMENTED. Open remainders: home decorating expansion (furniture/wall/porch placement — no implementation spec yet), shared cooking/meals, expanded Wild Hollows exploration.
- **Platform state:** `WorldState` v13, 1116/1116 unit tests, `tsc` clean, build green, three-layer boundary intact.

**Next milestone recommendation (design-first): Tier-gated invitations — Barnaby slice (LR-6).** With LR-5 merged, the last open Stage-1 item — tier-gated invitations across the remaining hosts (Barnaby, Sora, Toby) — becomes eligible. Recommendation: **one host per milestone, Barnaby first**. Rationale: Barnaby Woodshop's interior, station, and schedule already exist from Milestone 3; the LR-5 Arthur pattern (station occupancy + offer phases + `knowledgeGranted` + teaching follow-up + occupant rig) maps 1:1; highest narrative readiness at the lowest architectural risk; no schema bump; completes Stage 1 before Stage 4 deepening. **Governance precondition:** file `docs/architecture/living-relationships/27-lr6-barnaby-proposal.md` (mirroring 25/26) before any feature code, and do not invent requirements beyond the chassis's existing capabilities.

**Also open, by readiness (detail in §6/§8):** home decorating expansion (design-first candidate after LR-6), NPC Intelligence Evolution Tier 1–3 (owned work IN DEVELOPMENT — do not duplicate, directive §8), Sunday Market & seasonal festivals (PLANNED, no design docs), weather depth (snow/heavy rain/storms), cooperative community building phase.

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
| **Gardening** (full pillar) | IMPLEMENTED | Greenhouse (4 plots, 4 crops) + resident gardens: cottage window boxes, outdoor soil beds, orchard tending (PRs #40, #42, #44, #47). `gardens.ts` + GardenPanel; everyday-practice integrated. |
| **Fishing** | IMPLEMENTED | Willow Jetty (Stage 3) + West Brook Bank (v1.1, multi-spot `FISHING_SPOTS` registry). `src/game/fishing.ts`. One cast/day, zero-migration, deterministic. |
| **Photography** | IMPLEMENTED | Stage 3 Continuation. `src/game/photography.ts` (reducer + 13-subject registry) + `src/components/PhotoPanel.tsx` (viewfinder + album). Zero schema bump; first-of-subject journal memories + `framed_photo_keepsake` + `'photo'` witness dialogue echoes. No day-gate, no quota. |
| **Decorating** (full pillar) | PARTIALLY IMPLEMENTED | Vase flowers + 5-slot keepsake shelf only. Furniture arrangement, wall placement, porch decorating — DESIGNED. |
| **Cooking & shared meals** | PARTIALLY IMPLEMENTED | Hearth baking, tea brewing, bakery help, and recipe discovery (ingredient-gated unlocks + first-cook memories, PR #43) exist. Teachable exchange shipped via LR-4 knowledge; shared cooking/meals — PLANNED. |
| **Exploration & discoveries** | IMPLEMENTED | 4 wild destinations + journal discoveries |
| **Collectibles** | PARTIALLY IMPLEMENTED | Satchel (34 items incl. 5 pond catches + 3 community keepsakes + framed photo); photo album implemented (Photography); no general collection album |
| **Community activities** | IMPLEMENTED | 3 Community Projects (contribute + social consequences + keepsake rewards) with contribution progression (PR #41). Keepsake physical display complete (3 bespoke meshes + unified shelf map); visible reward rigs rendered (Pillar 4). No cooperative building phase (PLANNED). |
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
| **LR-3 invitation (Clara)** | IMPLEMENTED | `share_morning_pastry` + bakery occupancy + Clara invitation dialogue; merged via PR #45 |
| **LR-4 Teaching & shared hobbies** | IMPLEMENTED | `teaching.known` + `knowledgeGranted` chassis + teaching dialogue; commit `4acf2f3` |
| **LR-5 Arthur/Copperwheel hosting** | IMPLEMENTED | `share_workbench_hour` + `cw_bench` station occupancy + occupant rig; PR #46 |
| Tier-gated invitations across remaining hosts (Barnaby, Sora, Toby) | PLANNED — next milestone candidate | Post-LR-5 dependency cleared; Barnaby slice recommended first, design-first (§5) |
| Per-NPC memory-driven dialogue topics | PARTIALLY IMPLEMENTED | Engine supports `requiresNpcMemory`; more content desired |
| Deeper personal side arcs | PARTIALLY IMPLEMENTED | 6 storylines shipped; more desired |

### Pillar 4 — The Neighborhood Remembers
| Item | Status | Evidence / next |
| :--- | :--- | :--- |
| Environmental reactivity (blooming sills, restored fountain, cleared ivy, lit festoons, café tables, bell) | IMPLEMENTED | `narrative.ts:computeEnvironmentState`; `environmentRenderer.ts` |
| Community Projects (3 permanent flags) | IMPLEMENTED | `community.ts`; `sideFlags[worldFlag]` |
| Community Project **visible rewards** (plaza garland, orchard lanterns, pond mosaic scene rendering) | IMPLEMENTED | `src/scene/builders/plazaGarland.ts` / `orchardLanterns.ts` / `pondMosaic.ts`; progressive stages wired in `NeighborhoodCanvas.tsx:946-954` + `environmentRenderer.ts` (PR #41) |
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
| Procedural audio (room-tones, weather beds, foley, UI, page-turn) | IMPLEMENTED | `audio.ts`; page-turn foley via earshot exercise (PR #50) |
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
| **New connected districts** | DEFERRED (long-term) | `REGIONS` expansion; only after core neighborhood is sufficiently mature. Elevated to a strategic pillar — see §12 and `docs/architecture/lifelong-narrative/00-LIFELONG-NARRATIVE-VISION.md` (PROPOSED ST-4/ST-5). |
| **Pets** | DEFERRED (long-term) | `GAME_DESIGN.md:341` "LONG-TERM VISION." |
| **LayaAir engine migration** | SUPERSEDED (rejected) | `docs/architecture/layaair-reference/10-final-engineering-assessment.md` — reference only; not adopted. |

---

## 8. Strategic development sequence (6 stages)

This is the **recommended strategic direction**, subject to the actual state of the repository and existing approved specifications. The active milestone must have clear acceptance criteria, dependencies, ownership, and approved scope. This sequence is NOT authorization to start all stages simultaneously.

### Stage 1 — Finish Living Relationships — COMPLETE (reconciled 2026-11-28)
1. ~~**LR-3**~~ — SHIPPED (Clara's Morning Pastry; merged via PR #45).
2. ~~**LR-4**~~ — SHIPPED (Teaching & shared hobbies; commit `4acf2f3`).
3. ~~**LR-5**~~ — SHIPPED (Arthur Copperwheel; PR #46).
4. **Tier-gated invitations across remaining hosts (Barnaby, Sora, Toby)** — the remaining Stage-1 item; see §5 recommendation (Barnaby slice first, design-first).

Goal reminder: relationships grow through meaningful shared experiences, not added dialogue or score inflation.

### Stage 2 — Community Projects — CORE COMPLETE (reconciled 2026-11-28)
- ~~Resident contributions~~ — SHIPPED (PR #41).
- ~~Collaborative improvement~~ — SHIPPED (3 permanent projects + contribution progression).
- ~~Persistent environmental changes~~ — SHIPPED (visible reward rigs: plaza garland, orchard lanterns, pond mosaic; PR #41).
- ~~Relationship-influenced participation~~ — SHIPPED (PRs #44, #49).
- Open remainder: **cooperative building phase** (no design doc; community progression must remain believable and day-driven).

### Stage 3 — Everyday Activity Expansion — LARGELY SHIPPED (reconciled 2026-11-28)
1. ~~**Gardening**~~ — SHIPPED (window boxes, outdoor soil beds, orchard tending; PRs #40, #42, #44, #47).
2. ~~**Fishing**~~ — SHIPPED (Willow Jetty + West Brook Bank; PRs #37, #38).
3. ~~**Photography**~~ — SHIPPED (Stage 3 Continuation; see `docs/architecture/stage3-everyday-activities/05-photography-design.md`).
4. **Home decorating** (furniture placement, wall placement, porch) — open; design-first candidate.
5. ~~**Cooking — recipe discovery**~~ — SHIPPED (PR #43); shared cooking/meals remain open.
6. **Exploration and discoveries** (expand the Wild Hollows) — open.

Each activity must keep a meaningful place in the neighborhood simulation; no repetitive grinding systems. NPC participation in activities remains deferred pending simulation-owner coordination (do not build a second simulation framework).

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
- Additional neighborhoods / connected districts (`REGIONS`) — elevated to a strategic pillar (see §12).
- District expansion architecture, introduction philosophy & safeguards: see §12 and `docs/architecture/lifelong-narrative/00-LIFELONG-NARRATIVE-VISION.md` (PROPOSED ST-4/ST-5, not yet authorized).
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
| `docs/architecture/lifelong-narrative/00-LIFELONG-NARRATIVE-VISION.md` | SUPPORTING — strategic vision | Full expression of the §12 strategic pillar (lifelong-game ambition, narrative progression framework, 8 narrative engines, narrative web, district expansion strategy, proposed ST-0..ST-6 program, exploratory district concepts). Concise authoritative summary in `docs/MASTER-ROADMAP.md` §12. |
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

## 12. Strategic pillar — Storytelling, Narrative Progression & Lifelong World Expansion

> **Status: PROPOSED STRATEGIC DIRECTION — not an implementation authorization.** This pillar elevates storytelling, lifelong progression, district expansion, and narrative difficulty into explicit strategic priorities. It does NOT supersede the active milestone (§5: LR-3) or the Stage 3 everyday-activity work, and it does NOT authorize any implementation. Full framework: `docs/architecture/lifelong-narrative/00-LIFELONG-NARRATIVE-VISION.md`.

LITTLE SOMEWHERE is intended to be a game players can enjoy for years. The longevity ambition is comparable to games that remain engaging years after release — but achieved through **this game's own identity, systems, and philosophy**, never by copying another game's economy, competitive structure, monetization, timers, or grind. **Pillar 6 (No Stressful Progression) governs this expansion at all times.**

The pillar visibly recognizes:

- **Lifelong-game ambition** — a world that grows richer over years without making earlier life irrelevant; no FOMO, no daily-login requirements, no real-world decay, no grind.
- **Storytelling as a deliberate strategic pillar** — not an incidental feature; the 8 narrative engines (personal, relationship, everyday emergent, community, discovery, long-running, district, player-memory) are strategic content opportunities mapped onto existing systems.
- **Narrative progression & difficulty** — stories are approachable at the start and progressively richer; sophistication grows through character/location/event count, motivation complexity, observation/exploration, relationship integration, meaningful decisions, continuity, and cross-district consequences. ("Difficulty" here means **narrative sophistication and richness**, never punitive challenge or grind — see the full-vision doc's terminology note.) **A proposed Tier 1–6 framework** (Welcoming → Familiar community → Interconnected neighborhood → Investigative → Major community/district → Long-running/lifelong) is a strategic model for future validation — NOT built in gameplay, NOT presented to players as levels.
- **The narrative web** — stories increasingly connect where meaningful (activities feed stories, discoveries reveal history, journal preserves connections, NPC autonomy creates emergent opportunities authored stories acknowledge). **Independence safeguard:** not every story depends on another; the world needs a mixture of standalone, short, personal, multi-character, discovery, interconnected, long-running, and emergent stories.
- **District expansion as a long-term direction** — districts are not disposable map expansions; each supports a full ecosystem (residents, stories, routines, activities, discoveries, community projects, traditions, cross-district connections). **District introduction philosophy:** access emerges through natural world connections (discoveries, invitations, relationships, stories, transportation), not level-unlock notifications. **Safeguards:** no mandatory prerequisite chains, no friendship-threshold gates, no real-world timers, older districts stay accessible, mobile-performance validation required first.
- **Narrative sustainability** — the game stays enjoyable when the player is not pursuing an authored story (NPC autonomy + activities + exploration + community + emergent stories). No premature prescription of procedural/AI generation.

### Proposed ST program (all PROPOSED — not approved for implementation)

| Initiative | Purpose | Depends on |
|---|---|---|
| **ST-0** Narrative & Lifelong-Game Audit | Evidence-based audit of narrative content, systems, progression, district architecture, scalability | Nothing (verify existing audits first) |
| **ST-1** Narrative Architecture & Narrative Web | Scalable story lifecycle, discovery, progression, branching, continuity, authoring standards | ST-0 |
| **ST-2** Early-Game Story Excellence | Welcoming, memorable, non-tutorialized first experience | ST-0 |
| **ST-3** Narrative Interconnection | Strengthen cross-story/character/activity/discovery connections without dependencies | ST-0 |
| **ST-4** District Expansion Architecture | Expandable district architecture: identity, connectivity, travel, state, performance, save-migration | ST-1 + `REGIONS` + mobile validation |
| **ST-5** First Future District Expansion | Implement the first evidence-based district **when approved + dependencies satisfied** | ST-4 + owner approval |
| **ST-6** Lifelong Narrative Content Pipeline | Sustainable content-production process: authoring standards, QA, continuity validation | ST-1 + ST-4 |

**Dependency note:** ST-0 is the natural first step. ST-1/2/3 parallelize after ST-0. ST-4 depends on ST-1. ST-5 depends on ST-4 + owner approval. ST-6 depends on ST-1 + ST-4. **No ST initiative is authorized for implementation by this roadmap.** The active milestone (LR-3) and Stage 3 everyday-activity work remain the current execution priority.

### Exploratory district concepts (NOT APPROVED — examples only)

Six exploratory concepts (A — Home Neighborhood; B — Green District; C — Cultural; D — Waterside; E — Highland; F — Town Center) are documented in `docs/architecture/lifelong-narrative/00-LIFELONG-NARRATIVE-VISION.md` §9 as **exploratory examples only — NOT approved map plans, fixed names, geography, sequencing, or commitments to build**. Future district selection emerges from ST-4/ST-5 evidence-based planning. **Do not rename existing areas** (verify `willow_square`, Fern Hollow, Wild Hollows in the repository first).

### Guardrails for future agents

Any agent proposing narrative, story, or district work must: read this section + the full-vision doc first; audit existing narrative content before creating new stories (ST-0 discipline); respect the active milestone; **not independently invent** district progression, story tiers, content economies, or story architecture without design/roadmap review; preserve Pillar 6; validate mobile performance before district proposals; and use evidence for all claims.

---

## 13. Final

LITTLE SOMEWHERE must remain LITTLE SOMEWHERE. The goal is not to build the largest possible neighborhood or accumulate the most features. The goal is to build a neighborhood that feels like somewhere people genuinely live — a place where residents have their own lives, where relationships develop naturally, where ordinary activities become memorable experiences, where the environment remembers what happened, and where the player gradually feels that they belong.

**Preserve the vision. Respect the existing implementation. Establish one authoritative roadmap. Make the next development steps unmistakably clear.**
