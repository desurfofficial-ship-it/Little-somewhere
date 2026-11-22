# NPC Autonomy — Gameplay Demonstration Record

**Branch**: `feat/npc-intelligence-living-simulation` (rebased onto main `56ea1be`, schema v12)
**Demo script**: `scripts/npc_autonomy_demo.ts` (run: `npx tsx scripts/npc_autonomy_demo.ts`)
**Browser verification**: live game on `http://localhost:3001/`, Day 1, 8:18 AM → 2:35 PM, zero console errors, save persists `schemaVersion:12` with all 10 residents' `npcRuntime`.

## The 10 required demonstrations (all PASS)

The demo runs a fresh game world through multiple in-game days using the ACTUAL
game systems (`createFreshWorldState`, `stepSimulation`, `advanceToNextDay`,
`serializeWorldState`/`deserializeWorldState`) and observes:

1. **Multiple NPCs on different routines** — 10 residents start at 10 distinct
   morning-anchor places (Bakery, Greenhouse, Workshop, Gazebo, Pond, etc.).
2. **Autonomous activity choices** — residents pick non-anchor extra activities
   (e.g. `rowan_gate_blossom`, `clara_tea_break`) via the utility scorer.
3. **Navigation between locations** — 10/10 residents travel from home to their
   morning/afternoon anchors via the A* lane graph + LOS smoothing.
4. **Environmental interaction** — a resident is observed at a recognized
   environmental anchor (e.g. Clara at Hearth & Crumb Bakery).
5. **Two NPCs encounter one another** — an autonomous `ActiveSocialEncounter`
   forms between two residents (e.g. Clara & Nora near Bakery Porch).
6. **Autonomous social interaction** — the encounter produces a `worldEvent`
   summary ("Catching up over neighborhood news"), a firsthand participant
   memory (C1), and a relation `encounterCount` increment (C3).
7. **Routine interruption** — the player steals Clara's reserved bench; Clara
   yields the seat and re-selects a different activity (seat-stolen trigger).
8. **Recovery from an unavailable destination** — Clara's target is set to the
   unwalkable pond center; stuck-recovery fires at 2.8s, records the activity
   in `blockedActivityIds`, and re-selects a reachable target.
9. **Day transition** — `advanceToNextDay` advances Day 1→2, residents wake at
   8:00 AM with fresh runtime (waypoints cleared, needs reset).
10. **Correct save/load behavior** — `serializeWorldState` → `deserializeWorldState`
    round-trip is byte-identical on a fresh world.

## Facade spot-check (for LR-3/LR-4/LR-5 consumers)

The demo exercises the public `npcAutonomy.ts` facade:
- `getResidentActivity('clara')` → snapshot with activityId, placeName, needs, emotion
- `getResidentSocialPartner('clara')` → null (no active encounter at check time)
- `isResidentAvailableForActivity('clara')` → false (she was dwelling at dusk)
- `getPlayerRelationshipTier('clara')` → 'stranger' (fresh game)
- `getNearestConfidant('clara')` → 'mina' (baseline confidant)

## Adversarial QA (3 independent subagents)

Per directive §13, three parallel QA subagents challenged the implementation:

- **QA-SIM (Simulation Reviewer)** — found 1 CRITICAL (latent `_unstuckSeconds`
  module-scope determinism leak), 1 MAJOR (false partner-symmetry docstring),
  2 MINOR test-weakness issues. **All fixed.**
- **QA-GAME (Gameplay QA)** — found 1 MAJOR normal-play bug (`dusk:evening_home`
  wind-down drained energy instead of restoring it — the chosen `animState:'rest'`
  was clobbered by the default-pose fallback), 2 MAJOR state-corruption-only bugs
  (double-seat-claim, distant-unwalkable stuck-loop). **The normal-play bug is
  fixed; the corruption-only bugs are documented as sanitizer-self-healing
  territory (not reachable via normal selection).**
- **QA-PERF (Performance Reviewer)** — **PASS, no regression.** Per-tick cost
  0.015ms (0.09% of 60Hz frame budget); zero-GC steady-state holds; 4 MINOR
  micro-optimizations documented, none blocking.

Full disposition in the QA reports (session transcript). Confirmed defects fixed:
- QA-SIM D1: `_unstuckSeconds` moved from module-scope to `NpcRuntimeState`
  (ephemeral, cloned by `cloneNpcRuntime`, defaulted by sanitizer) — twin-
  determinism now holds even when `blockedActivityIds` is non-empty.
- QA-SIM D2: `getResidentSocialPartner` docstring corrected (round-robin, not
  symmetric, for 3-person encounters).
- QA-SIM D3/D4: test 10 tautology clause removed; test 11 warmup lengthened,
  window extended, +1ms cushion dropped.
- QA-GAME D1: dwelling-branch fallback now honors `:evening_home`/`:morning_wake`
  `animState:'rest'` instead of clobbering it — dusk wind-down now restores
  energy. Regression test added (test 13).

## Verification

- `npm test`: **686/686** pass (681 baseline + 5 new: occupied-destination,
  personality-divergence, performance-drift, facade-contract, dusk-energy-regression)
- `tsc --noEmit`: clean
- `vite build`: green
- `scripts/longrun_stress.ts`: all 7 scenarios clean, `byte-identical=true`,
  `twin_continuity=true`
- `scripts/npc_autonomy_demo.ts`: all 10 demonstrations PASS, deterministic
  across runs
- Browser: live game runs Day 1 morning→afternoon with zero console errors;
  save persists `schemaVersion:12` with all 10 residents' `npcRuntime`

## Remaining limitations (honest)

- The `encounterCount` field on `NpcNpcRelation` is recorded but has no
  consumer yet (future-telemetry hook, tracked in the fingerprint).
- The `encounter_friction`/`witnessed_chat`/`witnessed_friction` memory tags
  are recorded but no dialogue topic queries them yet (future-authoring hooks
  for content designers).
- LOD/distance-aware updates are NOT implemented — acceptable at the 9–12
  resident design ceiling (projected cost at N=50 is 0.65% of frame budget).
- The demo's forced-proximity fallback for encounter observation was never
  needed in practice (natural encounters fire consistently), but is retained
  as a safety net.
