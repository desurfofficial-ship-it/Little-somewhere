# 07 — Dialogue Sheet Redesign Proposals

**Date**: 2026-11-20  
**Constraint**: Preserve Premium Handcrafted Storybook Diorama identity, mobile-first, bottom-thumb reach, no new runtime dependencies.

---

## Concept A — Enhanced Storybook Sheet (Recommended Baseline)

**Description**: Evolve the current bottom sheet. Replace the colored initial with a larger portrait (or object illustration) on the left. Keep name, role, mood, and relationship indicators. Add a thin continue indicator and optional history drawer.

**Layout sketch (mobile)**:
```
┌─────────────────────────────────────┐
│ [Portrait]  Clara · Warm            │
│  72×72      Orchard Keeper · Friendly│
│             ♥♥♥♡♡                   │
│ “The crabapples are ready...”       │
│                                     │
│ [ Choice 1 ]                        │
│ [ Choice 2 ]                        │
└─────────────────────────────────────┘
```

**Strengths**:
- Minimal departure from existing muscle memory and code.
- Thumb-reachable.
- Portrait is prominent without covering the diorama.
- Easy to add object illustration in the same slot for prop cards.

**Weaknesses**:
- Less distinctive than a full visual-novel treatment.
- Multi-character conversations still feel single-threaded.

**Evidence**: Closest to Stardew / Animal Crossing patterns that players already accept; addresses the “tiny decorative icon” complaint by increasing portrait size and tying it to the speaker.

---

## Concept B — Dual-Column Narrative Panel

**Description**: On tablet/desktop, a wider panel with portrait on the left and a scrollable conversation history on the right. On phone, history collapses into a slide-up drawer.

**Strengths**:
- Excellent for longer story topics.
- History addresses a documented player desire.
- Clear speaker changes via portrait swap.

**Weaknesses**:
- More complex responsive behavior.
- Risk of covering more of the diorama on small phones if not carefully constrained.
- Higher implementation cost.

**Evidence**: Disco Elysium’s column + history and visual-novel logs. Useful for the subset of topics that are multi-node stories.

---

## Concept C — World-Attached Bubbles + Sheet Hybrid

**Description**: Short ambient lines appear as small bubbles near the 3D character. Deep conversations open the enhanced sheet (Concept A).

**Strengths**:
- Preserves world visibility for everyday chatter.
- Matches Night in the Woods for short lines.

**Weaknesses**:
- Two presentation paths to maintain.
- Bubble positioning in an isometric Three.js scene is non-trivial (screen-space projection, occlusion).
- Mobile finger occlusion remains a problem for bubbles.

**Evidence**: Night in the Woods and many life sims. Attractive but higher risk for a mobile-first browser game.

---

## Recommended Final Design

**Concept A as the primary interface**, with the following additions drawn from B and C:

1. Larger speaker portrait (or object illustration) as an integral left column element.
2. Portrait/expression key driven by the current node (see document 06).
3. Optional lightweight history (last 6 lines) accessible via a small “log” button; does not persist.
4. Continue chevron and instant-reveal on second tap if typewriter is later added.
5. Prop inspection reuses the same portrait slot for an object illustration.
6. No world-attached bubbles in the first implementation (can be a later polish pass).

### Why This Is Better

- Solves the “decorative icon” problem with a properly sized, speaker-owned visual.
- Stays within existing art direction and mobile constraints.
- Requires no new dependencies.
- Preserves all narrative IDs and save compatibility.
- Can be implemented incrementally after the seating bug is fixed.

### Potential Disadvantages

- Portrait assets must be created (procedural or canvas-based to stay zero-external-asset).
- History drawer adds a small amount of UI state.
- Expression variety will be limited until more portrait keys are authored.

### Testing

- Mobile (390×844) and desktop (1440×900) screenshots.
- Touch targets ≥44px.
- Choice availability still driven solely by engine.
- Existing dialogue tests remain green.
- No console errors; software-WebGL parity preserved.
