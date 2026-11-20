# 09 — Responsive and Accessibility Specification

**Date**: 2026-11-20

---

## 1. Viewport Targets

| Target | Width | Notes |
|--------|-------|-------|
| Small phone | 390×844 | Primary; thumb zone bottom |
| Large phone | 430×932 | Same layout, slightly more text |
| Tablet | 768×1024 | Sheet may widen; portrait can grow to 96px |
| Desktop | 1440×900 | Max-width ~36rem; centered bottom |

Safe-area insets must be respected (especially bottom and top on notched devices).

---

## 2. Layout Rules

- Sheet remains `items-end` (bottom docked).
- Max height of prose area: 28vh on phone, 32vh on desktop.
- Portrait slot: 64px (phone) → 80px (tablet+) .
- All interactive controls ≥44×44px.
- Choice buttons full-width on phone; may become two-column only if text is short and viewport ≥768px (optional; default single column).

---

## 3. Typography

- Display name: Fraunces (existing).
- Body: Plus Jakarta Sans, 15px minimum on phone, 16px on desktop.
- Mood/role: 12–13px, sufficient contrast against linen.
- Contrast target: espresso ink on cream ≥ 7:1 for body text.

---

## 4. Interaction

| Input | Behavior |
|-------|----------|
| Touch | Tap choice, tap continue, tap close |
| Keyboard | Enter/Space to continue or select focused choice; Esc to close |
| Controller (if added later) | D-pad moves focus; A confirms |

---

## 5. Accessibility

- `role="dialog"` and `aria-label` already present; keep them.
- Portrait is `aria-hidden` if name is announced; otherwise provide `alt`.
- Text size should respect user browser zoom.
- If typewriter is added: provide instant reveal on second tap and a reduced-motion path that shows full text immediately.
- History drawer must be keyboard-reachable and labeled.
- No timed progression; player controls advance.
- Color is never the only indicator of choice tone (icon or text label accompanies color).

---

## 6. Motion

- Sheet open/close: short slide-up (≤200ms). Respect `prefers-reduced-motion`.
- Portrait cross-fade on speaker change (≤150ms).
- No continuous pulsing or large kinetic effects.

---

## 7. Testing Checklist

- [ ] 390×844: all text readable, choices tappable, world still visible above sheet
- [ ] 1440×900: sheet does not stretch full width; portrait aligned
- [ ] Keyboard-only navigation through choices and close
- [ ] Reduced-motion: no essential information conveyed only by animation
- [ ] Software WebGL: sheet does not cause context loss or console errors
- [ ] Dynamic Island / notch: no controls obscured

These specifications are implementation-ready for the UI agent.
