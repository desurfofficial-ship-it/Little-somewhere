# Agent Prompt — Interior Seating Fix + Dialogue Sheet Redesign

You are a Senior Gameplay Systems Engineer, Technical Designer, and UI/UX implementer working on LITTLE SOMEWHERE.

## Context
Read these documents before writing code:
- docs/research/interior-bug-and-dialogue-redesign/01-project-and-system-audit.md
- docs/research/interior-bug-and-dialogue-redesign/02-interior-movement-bug-investigation.md
- docs/research/interior-bug-and-dialogue-redesign/07-dialogue-sheet-redesign-proposals.md
- docs/research/interior-bug-and-dialogue-redesign/08-recommended-dialogue-ui-architecture.md
- docs/research/interior-bug-and-dialogue-redesign/09-responsive-and-accessibility-specification.md
- docs/research/interior-bug-and-dialogue-redesign/10-implementation-and-testing-roadmap.md

Respect AGENTS.md layer boundaries, mobile/browser-first requirements, determinism, and save compatibility.

---

## Priority 1 — Fix Interior Seating Trap (Critical)

### Confirmed Root Cause
In `src/game/playerController.ts` (`stepPlayerMovement`, sitting branch), the stand-up path always calls `isInteriorPointWalkable` from `cottage.ts`. That function only knows cottage bounds and obstacles.

For bakery and copperwheel seats the approach position fails the check, so the player is left at `seatPos` (inside the chair collision volume). After posture becomes `standing` and `seatId` is cleared, every movement direction is rejected (0 free directions).

### Required Changes
1. Replace the cottage-only walkability check with a location-aware dispatcher:
   - `cottage_interior` → `isInteriorPointWalkable`
   - `bakery_interior` → `isBakeryInteriorWalkable`
   - `nook_interior` → `isNookInteriorWalkable`
   - `copperwheel_interior` → `isCopperwheelInteriorWalkable`
   - `greenhouse_interior` → `isGreenhouseInteriorWalkable`
   - outdoor → `isPointWalkable`
2. If the approach is still not walkable, perform a short deterministic radial search (8 directions at 0.35 and 0.55 units) for the nearest walkable point before falling back.
3. Add unit tests that, for every indoor seat, assert:
   - post-stand position is walkable under the matching interior function
   - at least 4 of 8 cardinal/diagonal directions produce displacement > 0.01
4. Keep outdoor bench behavior unchanged.
5. Run `npm test`, `npm run lint`, and `npm run build`.
6. Add a short WORKLOG.md entry for the seating fix.

### Constraints
- No save schema or WorldState changes.
- Preserve determinism and zero-allocation rules in the simulation step.

### Acceptance
Enter bakery or copperwheel, sit on the chair, apply movement input → player ends at a walkable position with free movement in multiple directions.

---

## Priority 2 — Dialogue Visual Identity

### Goal
Speaker portraits and contextual object imagery become first-class optional metadata.

### Required Changes
1. Add optional `portraitKey?: string` and `subjectImageKey?: string` to `DialogueNode` in `src/game/types.ts`.
2. Create pure resolvers in `src/game/dialogue/assets.ts`:
   - `resolvePortrait(key, residentId)` → procedural canvas descriptor or fallback
   - `resolveSubjectImage(key)` → object/environment descriptor or fallback
3. Default when keys are absent: current coat-color initial behavior (fully backward compatible).
4. Author default portrait keys for the 10 residents (procedural preferred — zero external assets).
5. Add subject image keys for common prop interactions (oak table, hearth, books, etc.).

### Constraints
- Preserve all existing topic IDs, memory IDs, conditions, priorities, and choice effects.
- No save migration. Fields are optional.
- Do not move selection logic into the UI.

---

## Priority 3 — Dialogue Sheet Redesign (Concept A)

### Goal
Implement the approved Enhanced Storybook Sheet from document 07.

### Required Changes
1. Replace the small colored initial with a larger speaker visual (64px phone / 80px tablet+) in the header.
2. Portrait/expression is driven by the current node’s `portraitKey` (or resolved resident default).
3. Prop inspection reuses the same visual slot for an object illustration.
4. Add a lightweight history drawer (last 6 lines, UI-only state, does not persist).
5. Add a continue chevron; if typewriter is later added, second tap instantly reveals.
6. Apply responsive and accessibility rules from document 09:
   - Bottom-docked, thumb-reachable
   - ≥44px touch targets
   - Body text ≥15px on phone
   - `role="dialog"` and proper labels retained
   - Respect `prefers-reduced-motion`
7. Verify existing dialogue tests still pass.

### Constraints
- No new npm dependencies.
- UI remains purely presentational; it does not write WorldState.
- Preserve Premium Handcrafted Storybook Diorama visual identity (linen surfaces, Fraunces + Plus Jakarta Sans, existing palette).

---

## Priority 4 — Polish and Validation

1. Headless Chromium screenshots at 390×844 and 1440×900.
2. Keyboard and touch pass.
3. Reduced-motion check.
4. Confirm no per-frame allocations introduced in scene tick.
5. Regression: sit/stand on all furniture; dialogue topic smoke test.
6. Update WORKLOG.md (and HANDOVER.md only if a contract actually changes).

---

## Sequencing
Complete Priority 1 first and verify it before starting Priorities 2–4. Dialogue work is additive polish and must not break the seating fix.

## Final Acceptance
- Player is never permanently trapped after a valid sit/stand.
- Dialogue sheet shows a meaningful speaker or subject visual that changes with the conversation.
- All existing narrative IDs, branching, memory, relationships, and saves remain intact.
- `npm test`, `npm run lint`, and `npm run build` are green.
