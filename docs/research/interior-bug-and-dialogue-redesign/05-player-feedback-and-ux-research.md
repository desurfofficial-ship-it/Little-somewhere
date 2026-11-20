# 05 — Player Feedback and UX Research

**Date**: 2026-11-20  
**Method**: Public reviews, Reddit threads, forum posts, and developer commentary. Isolated opinions are labeled as such; recurring patterns are highlighted.

---

## 1. Recurring Complaints (Cross-Game)

| Theme | Evidence | Frequency |
|-------|----------|-----------|
| Text too small on mobile | Stardew Valley iOS forum threads (iPhone 16 Dynamic Island, UI scale complaints); multiple Reddit posts | High |
| Dialogue box obstructs gameplay or is hard to tap | Stardew mobile UI threads; general cozy-game discussions | Medium |
| Slow typewriter / no skip | Common in visual-novel and RPG reviews (not dominant in Stardew) | Medium |
| No conversation history | Disco Elysium players sometimes request log access; visual-novel players expect it | Medium |
| Portrait inconsistency | Stardew mod threads about farmer portraits bleeding or mismatching sprites | Low–Medium |
| Repetitive late-game dialogue | Stardew Reddit (spouses, 10-heart NPCs) | High (content, not UI) |
| Confusing choice indicators | Stardew “question mark is a bug?” threads (players misread the design) | Low but instructive |

---

## 2. Positive Feedback Patterns

- **Disco Elysium**: Players and critics praise the vertical column, skill portraits, and the sense that the interface itself is part of the writing. Kurvitz cited Twitter-like cadence and bottom-right eye rest as intentional.
- **Persona 5**: Strong positive reception for visual identity and clarity once the initial spectacle is learned. Developers later reduced animation intensity for readability.
- **Night in the Woods**: Players enjoy the attachment of bubbles to characters and the low chrome; short, rhythmic lines are frequently cited as a strength.
- **Stardew Valley**: The simple portrait + name plate is rarely criticized on its own; complaints focus on size and late-game content repetition.

---

## 3. Mobile-Specific Notes

- Thumb-zone placement is critical. Bottom sheets are generally preferred over center modals for one-handed use.
- ≥44px touch targets are a baseline (already required by AGENTS.md).
- Dynamic Island / notch occlusion is a real complaint in recent Stardew iOS threads; safe-area insets matter.
- Players on phones often want larger text or a UI-scale option.

---

## 4. Implications for LITTLE SOMEWHERE

1. Keep the sheet bottom-docked and thumb-reachable.
2. Increase the visual weight of the speaker (portrait or strong initial + name) without covering the diorama.
3. Provide a way to skip or instantly reveal text if typewriter animation is added.
4. Surface a lightweight conversation history for longer topics.
5. Make choice tone or consequence readable at a glance (color or small icon already partially present).
6. Do not introduce heavy kinetic animation that fights the storybook art direction.
7. Treat portrait consistency as a content/asset problem: the same visual identity should appear in dialogue and, where possible, in the 3D scene.

These points are evidence-based constraints for the redesign proposals in document 07.
