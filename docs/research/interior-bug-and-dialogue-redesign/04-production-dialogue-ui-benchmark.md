# 04 — Production Dialogue UI Benchmark

**Date**: 2026-11-20  
**Sources**: Developer interviews, GDC talks, design articles, and direct observation of published interfaces. No single game is recommended for wholesale copy.

---

## 1. Disco Elysium

**Layout**: Vertical column on the right third of the screen. Text scrolls upward (Twitter-inspired). Portrait of the current speaker (or skill) appears as a small square to the left of the active line.

**Portraits**: Highly expressive, painterly, and context-sensitive (e.g., dissolving brushwork for certain characters). Change with emotional state.

**Choices**: Numbered list at the bottom of the column; locked or skill-check options are visually distinct.

**Key lessons**:
- Vertical reading flow keeps the eye in a natural resting zone (bottom-right on desktop).
- Portrait is tied to the speaking voice, not a static header.
- Text size and layout were explicitly tuned for Monitor / TV / Handheld (Taylor Wright, UI work).

**Relevance to LITTLE SOMEWHERE**: The upward-scroll column and per-line portrait are powerful but heavy for a mobile-first cozy game. The principle of “portrait belongs to the speaker of this line” is transferable.

---

## 2. Stardew Valley

**Layout**: Classic bottom dialogue box with character portrait on the left. Portrait is a pixel sprite matching the overworld character.

**Choices**: Simple list; question-mark icon signals that a selection is required.

**Player feedback patterns** (see document 05):
- Text size is a frequent complaint on mobile (especially iPhone with Dynamic Island).
- Portrait consistency between overworld and dialogue is valued.
- Repetitive late-game dialogue is a content issue, not a UI issue.

**Relevance**: Bottom-docked portrait + name + text is the closest existing pattern to the current DialogueSheet. Improvements should stay in this family for mobile thumb reach.

---

## 3. Persona 5

**Layout**: Highly stylized, angular, high-contrast. Portraits are large, expressive, and often animated. Dialogue boxes use bold type and strong color blocking.

**Design notes** (Atlus interviews):
- Early versions were “aggressively animated”; motion was later calmed for readability.
- Color and angle changes provide context without extra icons.
- UI is a character of the game, not a neutral frame.

**Relevance**: Full Persona-style kinetic UI would fight the “Premium Handcrafted Storybook Diorama” art direction. Selective lessons: strong but calm portrait presence, and clear visual hierarchy between speaker and choices.

---

## 4. Night in the Woods

**Layout**: Speech bubbles attached to characters in the world. Choices appear in a small carousel near the bubble.

**Technical notes** (Yarn Spinner usage):
- Lines begin with `Name:` so the engine can attach the bubble.
- Emoticons drive expression changes.
- Minimal chrome; the world remains visible.

**Relevance**: Overhead bubbles are attractive for short ambient lines but scale poorly for long story conversations and for mobile (finger occlusion). Hybrid approach (bubble for ambient, sheet for deep conversation) is possible but adds complexity.

---

## 5. Coffee Talk

**Layout**: Visual-novel style with large character portraits and a bottom text box. Brewing UI is skeuomorphic and separate.

**UX notes** (Game Developer article):
- Contrast and brightness changes signal interactivity.
- Micro-interactions on hover/selection.
- Clear naming of the result of an action.

**Relevance**: Large portrait + bottom text is comfortable for narrative focus. The game’s identity is more “visual novel” than LITTLE SOMEWHERE’s diorama; the portrait scale should be moderated so the 3D world remains readable.

---

## 6. Other Relevant Patterns

| Game | Pattern | Takeaway |
|------|---------|----------|
| Animal Crossing | Small portrait + name plate above text | Excellent for short, frequent interactions |
| Fire Emblem: Three Houses | Support conversations with large portraits and relationship context | Useful for relationship-tier display |
| Life is Strange | Cinematic letterboxing + choice list | Too heavy for a simulation loop |
| The Witcher 3 / Mass Effect | Wheel or list with camera focus | Camera systems not present here |

---

## 7. Cross-Cutting Observations

1. **Portrait ownership**: The best interfaces treat the portrait as belonging to the current speaker (or subject), not as a static conversation header.
2. **Text size & contrast**: Recurring player complaint across titles, especially on mobile.
3. **Choice clarity**: Players want to know when a choice is available and what tone or consequence it carries (color, icon, or label).
4. **History**: Games that support long conversations (Disco Elysium, visual novels) almost always provide a scroll-back or log.
5. **Motion**: Excessive animation harms readability; calm transitions are preferred once the novelty wears off.
6. **World visibility**: Cozy simulation players generally dislike dialogue that fully obscures the diorama.

These observations inform the three concepts in document 07.
