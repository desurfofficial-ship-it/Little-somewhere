# 00 — World & Environment Improvement Plan

**Initiative:** Living World — World & Environment Lead mission (Workstreams A–F)
**Recorded:** 2026-11-22, atop `origin/main` @ `07be49c` (WORKLOG Entry 058 base).
**Implementation status:** WP-1..WP-4 **implemented and verified on this branch** — final gates 611/611 tests (595 inherited unmodified + 16 new), `tsc` clean, boundary script OK, `vite build` green; WORKLOG Entry 059; HANDOVER §21.
**Owner:** World & Environment Lead (team ownership per `docs/architecture/master-architecture/04-module-ownership-matrix.md`: `worldMap.ts`, `navigation.ts`, `walkability.ts`, `environment.ts`, `exploration.ts`, `playerController.ts`).
**Method:** six parallel read-only specialist audits (Tasks 1-a..1-f, this directory), independent programmatic QA probes, then modular implementation packages WP-1..WP-4.
**Baseline gates at audit time:** 595/595 tests, `tsc` clean, boundary script OK, nav graph 50 nodes / 63 edges / 1 connected component, 105/105 landmark-pair reachability.

---

## 1. Executive summary

The world is in strong structural health: the collision/nav/scene triple is decimeter-accurate
(48/48 obstacle twins verified), all 14 landmark zones are routed, all 9 story→visual
environment contracts are consumed, and every interior is enter/exit-robust. **No location
classified Broken.** The weaknesses are concentrated in four systems:

1. **Player-radius calibration debt** — the nav graph and its tests are calibrated to the NPC
   radius (0.38/0.42) while the player walks at 0.48. This produces the only two player-visible
   movement defects (Foxglove Rise ramp pinch; bridge rail corner-cut) and a silent-failure A*
   fallback that masks them.
2. **Silence where the world should speak** — the game's best beat (a Wild Hollows discovery)
   grants silently; weather is silent outdoors; six sideFlag counters (pebbles, posies, wishes)
   have no visual echo; `weather_shift` and 5 other `WorldEventRecord.kind` values are never
   emitted; `DialogueCondition.seasons` is supported but never used by content.
3. **Purpose gaps** — Pinecone Woodshop, Sora's Tea Cart, the pond pier and Foxglove Rise host
   zero interactions or resident activity; `REGIONS`/`regionId` and `ResidentTraits.preferredZones`
   are persisted but read by no consumer.
4. **Community Projects seam** — the next milestone's "persistent environmental transformation"
   has no world-side contract yet, although a complete in-repo template exists
   (`side_orchard_gathering` vertical slice).

## 2. Workstream A — audit verdict (location inventory)

Full evidence: `audit-1a` (architecture), `audit-1b` (interiors), `audit-1c` (navigation),
`audit-1d` (environment), `audit-1e` (content), `audit-1f` (independent QA probes).

| Class | Items |
| :--- | :--- |
| **Complete** | Fountain Plaza, Stone Fountain, Old Bell Gazebo, Noticeboard, 7 benches, Mirror Pond + bridge + Hollow Oak, Willow Step Cottage (ext + interior), Sunbeam Greenhouse, Hearth & Crumb Bakery, Linden Book Nook, Copperwheel Cottage, Fern Hollow Orchard, Wild Hollows discoveries (Marigold Lane, Foxglove Rise, Sorrel Hollow, Bee Line), Old Stone Well seed pipeline |
| **Partially functional** | Pinecone Woodshop (building + zone + anchor, no door/purpose), Sora's Tea Cart (obstacle + anchor, no own interactable), Foxglove Rise access (reachable but tap-walk snags) |
| **Visual-only** | Pond pier + sailboat, west brook culvert, sorrel brooklet + footlog, lane signpost, bee-line cairn, willow courtyard dressing, cobble strips, mailbox, driftwood, greenhouse planter bench, marigold-lane drifts |
| **Missing** (designed, planned) | Region districts (`REGIONS` scaffold unused), Fishing/Decorating/Photography, Community Projects, night window |
| **Broken** | None |

Key measured facts (audit-1f): walkable = 68.7% of world; **walkable-but-nav-unreachable =
8.37%** (~132 m², mostly far-west margin + orchard fringe — open, not sealed); 31% of A* paths
contain one blocked leg at player radius (axis-sliding rescues most); 0 stale collisions; all
5 interior grids ≥98.9% reachable; all 5 interior ids handled by scene + migrations (no
stranding path).

## 3. The modular implementation packages

Each package is independently mergeable, test-covered, and additive. File ownership and
shared-file touches are recorded per `master-architecture/07-parallel-development-protocol.md`.

### WP-1 — Navigation & collision integrity (Workstreams A/B/QA defects; owned files)
- WQA-01 (High): widen Foxglove Rise ramp corridor; fix `rise_mound_east_of_deck` deck overlap;
  move `rise_deck` node onto the walkable deck strip.
- WQA-02 (Med): add bridge-deck nav nodes; split the rail-corner-cutting edge.
- WQA-03 (Med): add west-margin + orchard-fringe nav nodes to shrink ghost zones.
- WQA-05 (Low): add the missing `lane_signpost`, bee-line cairn, mailbox, planter-bench
  collision twins; fix the driftwood trigger offset (0.65 m).
- WQA-04 (Med): make `computeWaypointPath` fail loudly (log + straight-line marked fallback)
  instead of silently trusting exhausted A*.
- WQA-07 (Info): new guard tests — player-radius 0.48 node/edge sweep, all-pairs landmark
  connectivity, no-node-in-obstacle at player radius.
- Door-origin alignment (`bakery_door`, `copperwheel_door` inside inflated margins) + orchard
  west-edge nudge. Explicitly out of scope: flag-gated café-table collision (static obstacles
  would block when tables are hidden) — deferred to the Scene team's flag-aware collision.

### WP-2 — Environmental simulation upgrades (Workstream D)
- Winter snowfall on calm days (snow was gated on `breezy` only).
- Drive the renderer sun arc from the composer (`sunElevation`/`sunAzimuth` — currently dead
  outputs; renderer recomputes a private arc).
- Outdoor weather ambience: procedural rain-shower / breeze / winter-wind loops that follow the
  composed weather (rain was audible indoors only), software-WebGL-safe.
- Mediation style visual variants (`gentle_truth` / `festival_ring` render identically today).
- Deferred with rationale (plan only): mid-day weather shifts (persistence-team rollover
  surface), snow accumulation/blankets (scene-team seasonal pattern), night epilogue window
  (clock extension is a design decision), seasonal NPC activities (`onlySeasons` — sim team).

### WP-3 — Living feedback & interior usability (Workstreams B/C)
- F-UX-1: discovery grants surface a toast + chime (best beat in the game currently silent).
- Greenhouse interior camera parity (was rendering at exterior zoom).
- Snap/live interior focus mismatch unified (0.45 vs 0.42 first-frame reframe).
- Counter→visual echoes: `wellPebblesCount` grows the well-side pebble stack; posy picking
  thins meadow posy patches (first two echoes; the pattern is reusable for wishes/cairn).
- Deferred with rationale: Copperwheel/bakery occupant anchors + invitation graft (LR-3/LR-5
  owners per HANDOVER §20 — hand-rolled duplicates forbidden), greenhouse proxy widths,
  season-gated dialogue topics (narrative-team content, golden-snapshot protocol).

### WP-4 — Community projects world-side foundation + pilot (Workstream E)
- `src/game/communityProjects.ts`: pure registry (proposal → contribution stages → outcome →
  `worldChange { anchor, visualId, variants }` → resident life), shaped like
  `STORYLINES`/`EXPLORATION_DISCOVERIES`; state rides **sideFlags**
  (`project_sorrel_garden_*`) — zero schema bump, sanitizer-safe.
- `composeCommunityWorldState()` composed additively into `composeEnvironmentState`
  (exactly where `progression` was bolted on; the 9-field `EnvironmentalState` is not widened).
- `builders/communityTransformations.ts` + static-revision apply in `environmentRenderer.ts`
  (mirrors `orchardRig.setGatheringVisual`).
- Sorrel Hollow well-garden pilot: the world's strongest foreshadowing (discovery memory,
  Mina's promise, foxglove pipeline) becomes the first persistent transformation — a two-visit
  contribution loop on a new garden-bed interactable, journal rows, Mina `requiresSideFlag`
  check-in, day-keyed bloom variants (buds → bloom).
- Coordination note for Gameplay/NPC Simulation: contribution/cadence expansion (rosters,
  multi-resident contributions, noticeboard flyers) is Gameplay-owned; the registry contract
  here is the world-side half.

## 4. Testing & verification

Every package: new focused `node:test` suites + full `npx tsx --test` (all pre-existing tests
unmodified and green), `tsc --noEmit`, `scripts/check_layer_boundaries.ts`, `vite build`.
Movement changes additionally verified by the new player-radius sweep and landmark all-pairs
connectivity guards.

## 5. Expansion opportunities (Workstream F, plan-only, ranked)

1. **Give purpose gaps residents** — one Foxglove Rise vista routine (the only zero-story
   discovery zone) + tea-cart check-in; woodshop door/inspection interactable.
2. **Recurring Wild Hollows value** — weekly bee-log honey, posy gifting, well water-pail
   refill (all hooks exist).
3. **Region activation** — make `REGIONS` real (region-scoped bounds/zone/nav accessors) or
   freeze it; unblocks GAME_DESIGN §4.2 districts.
4. **World manifest generator** — kills stale doc claims ("33 nodes", "79 topics") with a
   generated truth file.
5. **Elevation registry** — replace the 2-case `getGroundHeightAt` with data-driven terrain
   zones.
6. **Post-bell community on-ramp** — noticeboard project flyer as the lightest entry into the
   WP-4 pipeline.

## 6. Governance record

- WORKLOG Entry 059 claimed for this initiative (branch `feat/world-environment-living-world`).
- Shared-file touches (additive-only, per doc 07 §6): `audio.ts` (ambient loop API),
  `environmentRenderer.ts` + `NeighborhoodCanvas.tsx` (scene seams), `actions.ts` (pilot
  interactable branch), `residents.ts` (one `requiresSideFlag` candidate), `narrative.ts`
  (compose additive). No schema bump; WorldState stays v11.
- Cross-team deferrals recorded in §3/§5 are filed for the respective owners (LR, Scene, Sim,
  Narrative, Persistence, Gameplay).
