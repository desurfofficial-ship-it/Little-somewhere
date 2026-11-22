# NPC Autonomy & Everyday Neighborhood Life — Implementation Plan

**Engineer**: Independent gameplay engineer (NPC autonomy domain)
**Branch**: `feat/npc-intelligence-living-simulation` (rebased onto current main `56ea1be`)
**Baseline**: 681/681 tests, tsc clean, v12 schema integrated

## 1. Current systems being REUSED (no reimplementation)

Prior turns delivered the NPC intelligence core on this branch. After rebasing onto
current main (which advanced to schema v12 with Community Projects, Social Foundation
SF-1..SF-4, Character Quality CQ-1, World-Quality Overhaul G-2/G-4/G-7, and LR-3
records), the following systems are already in place and verified coexisting:

- **Daily routines** — `RESIDENTS` 4-phase schedules + `RESIDENT_EXTRA_ACTIVITIES`
  weighted candidates; `getResidentScheduleSlot` anchor lookup; per-resident
  `morningLark`-scaled walk speed; activity-kind-varied dwell durations.
- **Autonomous decision-making** — `selectActivityForResident` multiplicative
  utility scorer: zone affinity (B2) × graded need utility (B3) × emotion bias
  (B4) × companion bias (C5) × trait modifier × weather modifier × crowding
  penalty × tightened ±10% seeded jitter + goalKind tiebreak (B5). RNG call
  count/order preserved for twin-determinism.
- **Needs & motivations** — `NpcNeeds` (energy/hunger/social/fulfillment) decay
  via the in-game clock in `updateResidentEmotionInPlace`; graded urgency drives
  all four needs (not just energy/hunger); urgent-need re-eval trigger (A2).
- **NPC-to-NPC social life** — `stepSimulationInPlace` Phase-3 O(N²) encounter
  pairing with sociability/tier/cooldown gating; firsthand participant + witness
  memories (C1/C2); `familiarity`/`encounterCount` with confidant tier gate (C3);
  occasional autonomous friction on guarded pairs (C4); gossip propagation with
  provenance/distortion/retention (existing `memories.ts`).
- **World awareness** — 51-node A* lane graph + LOS smoothing + soft separation
  (incl. main's G-4 player separation); seat registry with `isSeatClaimed` mutex;
  `getLandmarkAt` zone derivation; crowding penalty; main's G-7 seat-teleport guard.
- **Interruptions & recovery** — stuck-recovery re-selects activity + records
  `blockedActivityIds` (cap 4, auto-clears after 8s free movement via module-scope
  `_unstuckSeconds`); seat-stolen re-eval; main's CQ-1 frustrated-emotion on theft;
  encounter interrupt via `interruptSocialEncounter`; urgent-need re-eval.
- **Persistence & simulation time** — v12 schema (main's communityProjects + my
  optional `blockedActivityIds`/`familiarity`/`encounterCount`); sanitizer
  inherits baseline familiarity for v11 saves (ADV-1 Finding 1 fix);
  `computeWorldSaveRevision` tracks the new fields; `advanceToNextDay` resets
  runtime cleanly; main's G-2 future-save refusal.
- **Performance** — zero-GC tick (`_otherPositions` scratch, `getNpcRelationTierFast`
  zero-allocation tier lookup); per-tick `Set` event-id dedup (F1); bounded
  collections (npcMemories 14, worldEvents 40, activityHistory 8).

## 2. Identified MISSING gameplay capabilities (the gap)

The directive (§12) requires a **working gameplay demonstration** exercising 10
specific behaviors in the actual game systems — this is the primary gap. The
systems exist and are tested for invariants, but there is no observable narrative
demonstration a reviewer can run to *see* the neighborhood living.

Secondary gaps:
- A clean **public interface module** (§15) so LR-3/LR-4/LR-5 and future milestones
  can query NPC autonomy without importing internal helpers.
- Three test categories from §14 not explicitly covered: occupied-destination
  selection, personality-driven decision divergence, performance-sensitive update
  behavior under load.

## 3. Proposed implementation

1. **`scripts/npc_autonomy_demo.ts`** — a runnable demonstration that advances a
   fresh world through multiple in-game days and emits a journal of observable
   events, then asserts each of the 10 required demonstrations occurred:
   (1) multiple NPCs on different routines, (2) autonomous activity choices,
   (3) navigation between locations, (4) environmental interaction, (5) two NPCs
   meeting, (6) an autonomous social interaction, (7) a routine interruption,
   (8) recovery from an unavailable destination, (9) a day transition,
   (10) correct save/load. Uses `createFreshWorldState` + `stepSimulation` +
   `advanceToNextDay` + `serializeWorldState`/`deserializeWorldState` (the actual
   game systems, not a mock).

2. **`src/game/npcAutonomy.ts`** — a thin public facade exposing query helpers
   other teams need: `getResidentActivity(id, world)`, `getResidentDestination(id, world)`,
   `getResidentSocialPartner(id, world)`, `getResidentNeeds(id, world)`,
   `isResidentAvailableForActivity(id, world)`, `getNearestConfidant(id, world)`.
   Pure read-only functions over `WorldState`; no new state; no chassis-file edits.

3. **Test gap fillers** in `src/game/npcBehavior.test.ts`:
   - occupied-destination selection (NPC yields a claimed seat and picks alternative)
   - personality-driven divergence (same situation, different traits → different choice)
   - performance-sensitive update behavior (tick cost stays bounded under load)

## 4. Files I intend to own
- `scripts/npc_autonomy_demo.ts` (new)
- `src/game/npcAutonomy.ts` (new)
- `src/game/npcBehavior.test.ts` (extend, already mine)
- `docs/architecture/npc-intelligence-living-simulation/01-gameplay-demonstration.md` (new — demo record)

## 5. Interfaces required from other systems
- `createFreshWorldState`, `stepSimulation`, `advanceToNextDay`, `serializeWorldState`,
  `deserializeWorldState` — existing public API (storage.ts/simulation.ts).
- `RESIDENTS`, `RESIDENT_EXTRA_ACTIVITIES`, `RESIDENT_ORDER` — existing (residents.ts).
- `getNpcRelation`, `getNpcRelationTier`/`Fast`, `getRelationshipTier` — existing (relationships.ts).
- No new interfaces requested from LR-3 / everyday / character-quality / world teams.

## 6. Dependencies
- None new. The branch already carries all NPC autonomy code and is rebased on main.

## 7. Acceptance criteria
- `npm test` green (681 + new tests).
- `tsc --noEmit` clean.
- `vite build` green.
- `scripts/longrun_stress.ts` clean with byte-identical replay.
- `scripts/npc_autonomy_demo.ts` runs and prints a journal demonstrating all 10
  behaviors; exits 0.
- `npcAutonomy.ts` facade compiles and is consumed by the demo.
- Independent QA subagents (simulation reviewer, gameplay QA, performance reviewer)
  find no CRITICAL/MAJOR defects; confirmed findings fixed.

## 8. Failure cases & test strategy
- Demo must handle: NPC never socializes (fall back to a forced-proximity scenario
  to guarantee the encounter demonstration); NPC gets stuck (the recovery path is
  itself one of the 10 demonstrations); save/load mid-encounter (round-trip assert).
- Tests use the pure `stepSimulation` path (deterministic) and the stress harness
  for long-run stability.
- Adversarial QA attempts to produce stuck NPCs, repeated interactions, broken
  schedules, performance regressions.

## 9. Integration notes (for the main agent)
- No schema bump (v12 stays). No chassis-file edits (`invitations.ts`/`activities.ts`/
  `occupancy.ts` untouched — LR-3 ownership respected per directive §8).
- `npcAutonomy.ts` is a read-only facade; future milestones (LR-4 teaching, LR-5
  Arthur/Copperwheel, community activities) can import it to query resident state
  without coupling to simulation internals.
- The demo script is a developer/QA artifact (not shipped to players); it doubles
  as a regression guard.
