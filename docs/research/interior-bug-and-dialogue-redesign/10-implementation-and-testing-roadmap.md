# 10 — Implementation and Testing Roadmap

**Date**: 2026-11-20  
**Policy**: Do not interrupt higher-priority committed milestones. The seating bug is a correctness fix and may be scheduled as a small dedicated pass. Dialogue work is additive polish.

---

## Priority 1 — Critical Gameplay Bug (Seating / Collision)

**Goal**: Player is never permanently trapped after a valid sit/stand interaction.

### Tasks
1. Replace cottage-only walkability check in `stepPlayerMovement` with location-aware dispatcher (document 02).
2. Add optional short radial recovery if approach fails.
3. Add unit tests covering all indoor seats (stand position walkable + ≥4 free directions).
4. Run `npm test`, `npm run lint`, `npm run build`.
5. Manual verification in bakery and copperwheel interiors.

**Dependencies**: None.  
**Save impact**: None.  
**Estimated scope**: Small (1–2 files + tests).

**Acceptance**: Reproduction sequence in document 02 no longer traps the player.

---

## Priority 2 — Dialogue Visual Identity

**Goal**: Speaker portraits and contextual object imagery exist as first-class, optional metadata.

### Tasks
1. Add optional `portraitKey` / `subjectImageKey` to `DialogueNode` (types.ts).
2. Create pure `dialogue/assets.ts` resolvers with procedural fallbacks.
3. Update `DialogueSheet` to render a larger visual in the header slot.
4. Author default portrait keys for the 10 residents (procedural or simple canvas).
5. Add object illustration keys for the most common prop interactions (table, hearth, books, etc.).

**Dependencies**: Priority 1 complete (so playtesting is not blocked).  
**Save impact**: None (optional fields).  
**Estimated scope**: Medium.

---

## Priority 3 — Dialogue Sheet Redesign

**Goal**: Implement the approved Concept A enhancements (document 07).

### Tasks
1. Refactor header to use the new visual slot and improved hierarchy.
2. Add continue indicator.
3. Add optional history drawer (UI-only, last 6 lines).
4. Unify prop-card visual treatment with the same slot.
5. Apply responsive and accessibility rules from document 09.
6. Verify existing dialogue tests still pass.

**Dependencies**: Priority 2 (visual identity) so the sheet has something to display.  
**Save impact**: None.  
**Estimated scope**: Medium.

---

## Priority 4 — Polish and Validation

**Goal**: Production readiness.

### Tasks
1. Headless Chromium screenshots at 390×844 and 1440×900.
2. Keyboard and touch pass.
3. Reduced-motion check.
4. Performance: confirm no per-frame allocations introduced in scene tick.
5. Regression: sit/stand on all furniture; full dialogue topic smoke test.
6. Update WORKLOG.md and HANDOVER.md only if architecture or contracts change.

**Dependencies**: Priorities 1–3.  
**Estimated scope**: Small–Medium.

---

## Sequencing Notes

- Priority 1 can ship independently and should be treated as a bugfix pass.
- Priorities 2–4 are polish and can follow the existing everyday-life roadmap or be scheduled after the next committed narrative milestone.
- No new npm dependencies are required for any priority.
- All work preserves topic IDs, memory IDs, branching, conditions, relationship mechanics, and save compatibility.

---

## Handover Checklist for Implementing Agent

- [ ] Read documents 01–03 before touching playerController.
- [ ] Read documents 06–09 before touching DialogueSheet.
- [ ] Run the full test suite after each priority.
- [ ] Do not rewrite AGENTS.md or ARCHITECTURE.md unless a contract actually changes.
- [ ] Record the seating fix in WORKLOG.md.

This roadmap is dependency-ordered and ready for review.
