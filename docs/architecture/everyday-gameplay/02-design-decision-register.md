# Everyday Gameplay Systems — Design Decision Register

- **Date**: 2026-11-22
- **Status**: ADOPTED (decisions GA-D1..GA-D9)
- **Basis**: audit synthesis in `01-audit-synthesis.md`; constitution in `00-improvement-plan.md` §1.

## GA-D1 — Community Projects become a sibling registry, not a shared-activity host

**Decision**: `COMMUNITY_PROJECTS` mirrors the `SHARED_ACTIVITIES` registry pattern (def-driven, map lookup) but is a **separate slice** (`world.communityProjects`) with its own transactional reducer.
**Why**: the LR chassis's occupancy model supports one indoor occupant anchored to an invitation; community contribution happens at a public exterior prop with no host body. Reusing `occupancy` would have forced a schema redesign of a working, contract-pinned system (doc 22 single-writer law). The registry pattern preserves the "add a def, zero code change" reusability contract.
**Rejected**: (a) logging contributions into `worldEvents` only — the 40-cap ledger is lossy and eviction would silently un-complete projects; (b) folding community into `SHARED_ACTIVITIES` as a second def — wrong venue model, wrong reservation lane (LR-3/4/5 names reserved).

## GA-D2 — Contributions are any-of goal baskets, never obligations

**Decision**: each project def lists `accepts: { itemId, goal }[]`; completion = all goals met. No deadlines, no expiry, no cadence, no daily cap (item supply self-limits through daily gathering rhythms).
**Why**: GAME_DESIGN §12.2 leaves cadence `UNDECIDED`; the zero-FOMO constitution forbids login-streak mechanics. Goals of 2–8 ordinary items land inside natural 3–5 day play cadences without ever being demanded.
**Rejected**: weekly/seasonal resets (FOMO); currency-priced contributions (no-economy law); per-contribution journal memories (journal spam — completion only).

## GA-D3 — The noticeboard is the single contribution surface (and stays a public prop)

**Decision**: the plaza noticeboard's existing `interactWithProp` card gains community shelf lines + an action button opening the new panel; contribution itself costs **no in-game minutes**.
**Why**: GAME_DESIGN §11.3 forbids folding shared plaza props into pocket inventory — we only read through the prop, never take it over. Free contribution keeps the ritual light; the cost lives in the gathering, not the paperwork.

## GA-D4 — Persistent community rewards = `sideFlags[worldFlag]` (the Bell precedent)

**Decision**: completion sets one `sideFlag` per project (`communityGarlandComplete`, `communityOrchardLanternsComplete`, `communityPondMosaicComplete`) and nothing else visually.
**Why**: "rewards remain permanently visible in the town" is the World team's render lane; the Gazebo Bell established flags → environment/renderer as the sanctioned handoff. This initiative ships zero scene changes and documents the flags for World consumption.
**Rejected**: rendering garlands/lanterns ourselves (duplicates World ownership; doc 10 scopes community environmental work out of gameplay teams).

## GA-D5 — Care streaks are deterministic attention rewards, not skill checks

**Decision**: `waterStreak` counts consecutive watered nights per actively-growing plot; ≥ 3 yields a lush harvest (+1 crop). Missed nights reset the streak and simply wait; winter resets it as part of the existing freeze.
**Why**: adds memory and tenderness to the one binary verb in the loop without RNG, failure states, or grind — the streak is the natural play pattern anyway. Deterministic = testable and save-stable.
**Rejected**: moisture gradients (0..1) + refillable can — a bigger UI surgery on a working panel, revisited only if a future design demands per-plot verbs; fertilizer/compost (new resource loop, feature-bloat risk).

## GA-D6 — Rain does the carrying, not the growing

**Decision**: `light_rain` makes greenhouse watering cost 0 minutes (rain chain prose); it does **not** auto-water pots.
**Why**: preserves the daily agency of the watering ritual (the core loop) while making weather tangibly responsive. The greenhouse stays indoor-manual — thematically correct per the audit.
**Rejected**: rain auto-watering pots (removes the ritual); rain watering exterior props (they have no watering mechanic — their cost is the harvest gather itself).

## GA-D7 — Progression surfaces derive-only (extension of the SF-1 doctrine)

**Decision**: the Everyday Practice Profile (`everyday.ts`) reads only existing persisted counters, computes tiers/titles/touchedToday, and persists nothing. Journal card + future UI consume the derivation.
**Why**: identical save ⇒ identical presentation is a standing invariant; a persisted "practice XP" would be a memento flag violation and a grind magnet. Eight practices map 1:1 onto counters that already exist (greenhouse totals, kneading sessions, books read, teas shared, winding sessions, discoveries, gifts/visits, contributions).
**Rejected**: persisted practice ledger (schema cost, grind framing, drift risk); scene memento integration (progressionVisuals already covers the 3D lane; journal is the participation lane).

## GA-D8 — Honest grants: one path, truthful chips

**Decision**: `applyItemGrants` becomes the single multi-item grant path; every adoption site's `gainedItems` chips now report what actually entered the satchel; overflow is silent-in-state but honest-in-prose where it matters (hearth overflow note).
**Why**: the audit found every historical call site ignored the stack-clamp — chips could promise items the satchel never received. One path kills the ~20 bespoke grant blocks' drift class.
**Rejected**: raising `MAX_ITEM_STACK` (changes the deliberate cozy scarcity); total satchel capacity (explicitly `UNDECIDED` in design; not our lane).

## GA-D9 — Durations stay honest atomic spends; no PendingActivity

**Decision**: everyday activities keep the atomic reducer shape (start = commit), now routed through `time.spendMinutes` (single clamp + gentle `eveningSlippedAway` signal at adoption sites). A pending/interruptible craft state machine is explicitly out of scope.
**Why**: the audit found the existing instant commits safe by construction — the only interruption surface that matters (shared activities) is already owned by the chassis. A `PendingActivity` slice would touch the tick path, the modal flow, and the sanitizer for near-zero player value today.
**Rejected**: cosmetic setTimeout brew animations becoming real timers (dead-unmount hazards the audit already flagged in the current modal).
