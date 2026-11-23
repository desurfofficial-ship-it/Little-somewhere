# UI/UX Improvement Program — Cohesive Plan & Implementation-Ready Work Packages

**Program**: LITTLE SOMEWHERE UI & Player Experience Development (Workstreams A–G)
**Date**: 2026-11-22
**Baseline**: `origin/main` audit point (WorldState v11, 595/595 unit tests green, `tsc` clean, build green)
**Method**: Six parallel independent audits (UI architecture research, dialogue UI, HUD & interaction, journal & inventory, UX & accessibility, live usability walkthrough) over the full UI layer + live headless-Chromium sessions at 1440×900 and 390×844 with 0 console errors.

> **Governing principle (from AGENTS.md)**: the visual constitution, three-layer separation, 44px touch floor, no-`backdrop-filter`-over-WebGL rule, and mobile-first parity are non-negotiable. This plan **does not redesign** the interface; it repairs, aligns and completes it — every work package is additive or corrective, preserves journal data & persistence (`WorldState v11`), and keeps `npm test`, `npm run lint`, `npm run build` green with browser QA at both target viewports.

---

## 1. Executive Summary

LITTLE SOMEWHERE's interface is strong: the three-layer separation is intact and healthy, all HUD controls meet the 44px floor, the storybook identity is honored on every surface, empty states are warm and actionable, and the dialogue sheet's camera framing + player-facing pose are excellent contextual feedback. The audit found **no P0 defects** and **no broken responsive behavior** (zero horizontal overflow at 390/768/844-wide viewports, live-verified).

The debt is concentrated and specific:

1. **Modal system integrity** — six hand-rolled surfaces with ad-hoc exclusion logic: journal/satchel shortcuts stack over an active conversation (live-verified), `Esc` closes the *underneath* surface rather than the top-most one (live-verified), and reward toasts render *under* modal backdrops (the game's core "Memory saved" signal is dimmed at its most important moment).
2. **Onboarding never happens** — the intro tip's dismissal condition makes it structurally impossible to see on a fresh save (a nearest-target exists at spawn), and no other surface teaches journal, satchel, gifting, or rest-to-advance.
3. **Consequence visibility is intermittent** — trust deltas from ordinary choices are silent; the gift loop is trial-and-error because engine gift-preference data (`RESIDENT_GIFT_PREFS`) is player-invisible; the conversation history drawer omits the player's own choices and duplicates the current line.
4. **WCAG AA gaps on exactly the most important controls** — linen-on-terracotta primary buttons at 3.6:1, invisible focus ring on terracotta/sage surfaces, empty hearts at 1.8:1, plus missing focus management/`aria-modal` on all six dialogs (keyboard users can act on invisible controls behind backdrops — including an unconfirmed world-reset button, the single worst data-loss path).
5. **Mobile parity holes** — no `+2h` time advance and no camera zoom on touch; both are desktop-only affordances despite the mobile-first constitution.
6. **Journal coherence** — "Discoveries" behaves as an almanac; cross-links (Person → their Stories) are dead-ends; read-state survives world reset so a fresh Day 1 reads as pre-read; two copy defects (bell title "Silent" vs "Quiet"; spring landmark copy references autumn leaves).
7. **Token drift beneath an enforced palette** — the 13 canonical hexes are 100% tokenized (the discipline test works), but ~83 derived hex literals multiply underneath it, including 1-char drift variants (`#B55639` vs `#B45539`), six linen opacities for the same surface, and three backdrop strengths.

Everything below is sequenced so the highest player-impact, lowest-risk fixes land first.

---

## 2. Evidence Base (convergent findings)

Findings that appeared independently across multiple audits (strongest confidence):

| # | Finding | Severity | Confirmed by | Live evidence |
| :-- | :--- | :--- | :--- | :--- |
| F1 | `KeyJ`/`KeyI` open journal/satchel **over an active conversation**; two `role=dialog`s coexist | P1 | 3-a S1, 3-b F3, 3-e F13 | Live: journal over Jun dialogue, snapshot shows 2 dialogs |
| F2 | `Esc` closes dialogue/propCard **first** while journal/satchel stay on top — inverted vs z-order | P1 | 3-a S2, 3-e | Live: one Esc removed the hidden conversation, journal remained |
| F3 | Toasts render in the z-10 HUD **under modal backdrops**; "Memory saved" reward is dimmed/missed | P1 | 3-a S4 | Code: `App.tsx:1362-1374` not gated/hoisted |
| F4 | Intro tip **cannot appear** for new players (`nearestTarget` exists at spawn; dismissed on any target; 5s auto-dismiss) | P1 | 3-c F1 | Live fresh save: tip absent, "Enter Cottage" CTA present |
| F5 | Primary buttons: linen-on-terracotta = **3.6:1** (AA needs 4.5); sage buttons 4.08:1 | P1 | 3-e F4 | Computed live |
| F6 | `:focus-visible` ring (terracotta) **invisible on terracotta/sage surfaces** | P1 | 3-e F2 | Computed live on active tab & primary CTA |
| F7 | No focus management/`aria-modal`/inert background on any dialog; Tab reaches invisible HUD controls **including the unconfirmed world-reset buttons** | P1 | 3-a S5, 3-e F1+F3 | Live: first Tab after opening Pause lands on "+2h" behind backdrop |
| F8 | Conversation history records only NPC lines and duplicates the current line | P1 | 3-b F1+F2 | Live: player's choice absent; last entry == visible prose |
| F9 | `+2h` hidden below `sm:` — **no mobile time advance** except Journal→Discoveries→footer card | P1 | 3-c F2, 3-e F10 | Live 390×844: button absent |
| F10 | Gift preferences (`RESIDENT_GIFT_PREFS`, loved/liked) player-invisible → trial-and-error gifting | P1 | 3-b F4, 3-d F3 | Code + live picker |
| F11 | No journal/satchel unread badge on HUD; letters/memories land silently | P2 | 3-c F7, 3-d F2 | Code |
| F12 | Ordinary choice trust deltas produce **no feedback**; `recentToast ?? milestoneLabel` masks milestones; hearts animate only on tier pulse | P2 | 3-b F5 | Live: hearts 1→2 with mundane gift toast |
| F13 | Read-state key survives `resetWorldState` → fresh world opens a pre-read journal | P2 | 3-d F5 | Code: `storage.ts` reset writes only world key |
| F14 | Spring Day-1 landmark copy reads "Dry autumn leaves…" | P2 | 3-d F10 | Live journal text |
| F15 | Bell storyline title "The **Silent** Gazebo Bell" vs chapter "The **Quiet** Gazebo Bell" | P2 | 3-d F11 | Live journal text |
| F16 | Desktop hover gives zero affordance over 18 world props/seats/carryables; tap-to-interact on moving residents is unreliable (3 failed click attempts in walkthrough) | P2 | 3-c F3, 3-f | Live walkthrough |
| F17 | Prop card reads like a conversation (no eyebrow, shared chrome) | P3 | 3-b F11 | Live |
| F18 | Empty hearts 1.8:1; hearts sit on role-less `div` with `aria-label` (dropped by most SRs) | P2 | 3-e F6 | Live |
| F19 | Scrollable inner regions lack `tabindex="0"` — keyboard-unreachable scroll | P2 | 3-e F9 | Code sweep |
| F20 | Reduced-motion gaps: brew flame `animate-pulse`, veil fade, joystick transition | P2 | 3-e F7 | Code |
| F21 | 3D canvas mount = unlabeled clickable generic for SR users | P2 | 3-e F8 | Live a11y tree |
| F22 | Token drift: `#B55639` vs `#B45539` terracotta-deep; linen opacity rungs /85 /88 /90 /92 /94 /95; backdrop /10 /45 /50; DialogueSheet unique border system | P2 | 3-a T1–T8 | Code sweep |
| F23 | Seated-with-drink CTA offers only `Sip {drink}` (one-option trap; walk/tap escapes exist) | P3 | 3-c F12 | Code |
| F24 | Toast system: single slot, no queue, non-restarting timer, clobbers concurrent events | P3 | 3-c F8 | Code |
| F25 | Dialogue meta line wraps with leading "·" (live-verified mobile); continue chevron faint 3.60:1; sage toast text 4.08:1 | P2/P3 | 3-b F7+F8+F10 | Live mobile |
| F26 | Portrait/subject canvases repaint on every sheet re-render (descriptor identity unstable) | P3 | 3-b F14 | Code |
| F27 | `initialTab` prop dead; journal tabs are dead-end data silos (no Person→Stories links) | P2 | 3-d F4 | Code |

---

## 3. Work Packages (implementation-ready)

Sequenced WP1 → WP5. Each is independently shippable; each lists scope, files, acceptance criteria, risk. All preserve `WorldState v11` (no schema change), the dialogue engine ownership boundary (selection logic stays engine-owned), and journal persistence.

### WP1 — Modal Integrity Pack *(P1 · Effort S–M · Risk low)*
Fixes F1, F2, F3, F7-part, plus the destructive-reset guard (F7 chain).
- **Files**: `src/App.tsx`, `src/components/{DialogueSheet,JournalDrawer,InventoryDrawer,CottageStationModal,GreenhousePanel,PauseModal}.tsx`.
- **Scope**:
  1. Gate `KeyJ`/`KeyI` (and `KeyM` title-screen ordering cleanup) on `!dialogueSession && !propCard` — conversations are protected surfaces.
  2. Reorder the `Esc` chain to close the **top-most** open surface first (dialogue when no panel is above it; otherwise panel → dialogue → pause). Single source of truth: compute the open stack from existing booleans at handler top.
  3. Hoist the toast layer to a dedicated `z-[60]` (above Pause) `aria-live` container with `pointer-events-none` so reward feedback is always visible.
  4. Pause safety: opening pause from the HUD button closes journal/satchel/station panels first (already unreachable-by-pointer; make it deterministic).
  5. Destructive reset confirmation: `TitleOverlay` "Start New Neighborhood" and `PauseModal` "Start Fresh Neighborhood" gain an inline two-step confirm (arm → confirm state, no nested modal), with focus returned to the trigger on cancel.
- **Acceptance**: journal cannot open during a conversation; Esc always closes the visually top-most surface; "Memory saved" toast is fully visible while the dialogue sheet is open; reset requires an explicit second activation; all existing tests stay green.
- **Explicitly out of scope**: `openSurface` union refactor and `ModalChrome` extraction (registered as Defer-D1).

### WP2 — Dialogue Honesty & Feedback Pack *(P1 · Effort S–M · Risk low)*
Fixes F8, F12, F17, F25, F26, plus gift-hint surfacing (F10, UI half).
- **Files**: `src/components/DialogueSheet.tsx`, `src/components/DialogueVisuals.tsx`, `src/components/InventoryDrawer.tsx` (unchanged unless hint copy), `src/game/inventory.ts` (pure read helper only), `src/App.tsx` (thread the selected choice label), `src/index.css` (one keyframe + reduced-motion guard).
- **Scope**:
  1. **Honest history**: append the player's chosen `choice.label` as a "You" entry when a choice is made; stop appending the current node (the drawer shows the last 6 *exchanged* lines). Keep UI-only, per-conversation reset, never persisted (Concept A contract).
  2. **Consequence rows**: render `recentToast` and `milestoneLabel` as independent rows (never `??`-masked); add a brief honey fill-pulse to newly earned hearts keyed off `milestonePulseSeq` (guarded by `prefers-reduced-motion`).
  3. **Prop card eyebrow**: "Taking a closer look" micro-label above prop titles + dashed inset on the subject slot so inspection is visually distinct from conversation.
  4. **Meta wrap fix**: prevent the leading "·" wrap on the role·emotion·tier line (wrap on the separator itself via span packing).
  5. **Contrast micro-fixes**: sage feedback text → deep-sage ink `#4C6B50`; umber picker notes → `#6A5B50`; continue chevron to full opacity inside a soft scrim pill.
  6. **Memoize portrait/subject descriptors** (`useMemo` on key+residentId) to stop per-render canvas repaints.
  7. **Gift hints (UI half)**: pure helper `getGiftTierHint(residentId, itemId)` in `inventory.ts` (reads existing `RESIDENT_GIFT_PREFS`, returns "loves"/"likes" only for items in the player's satchel — no full-table leak); the gift picker renders the hint per row.
- **Acceptance**: history reads as a two-sided exchange without duplicates; trust gains visibly pulse the heart row; prop cards are unmistakably inspection; no canvas repaint without a real descriptor change; hint only appears for carried giftable items; tests green (`dialogueAssets.test.ts`, sheet suites, snapshot unchanged — no topic/registry changes).

### WP3 — Accessibility & Contrast Pack *(P1 · Effort M · Risk low)*
Fixes F5, F6, F18, F19, F20, F21 and the focus-management half of F7.
- **Files**: `src/index.css`, one shared hook `src/components/useDialogA11y.ts` (new), the six surface components, `src/components/icons.tsx` (hearts glyph usage), `src/scene/NeighborhoodCanvas.tsx` (mount div attributes only — zero render-loop changes), `src/App.tsx` (error boundary alert).
- **Scope**:
  1. **Focus kit** (new `useDialogA11y`): on open — save active element, focus the surface heading (or first focusable), trap `Tab`/`Shift+Tab` within the surface, restore focus on close; sets `aria-modal="true"` on the dialog. Applied by all six surfaces.
  2. **Focus ring**: global `:focus-visible` outline switches to espresso ink + 2px terracotta outer halo — visible on every surface color (single `index.css` rule; removes TitleOverlay's per-button overrides).
  3. **Button contrast**: filled primary buttons render `bg-terracotta-deep` (`#B45539`, 4.5:1) as base with `bg-terracotta` hover; sage-filled buttons switch to `bg-sage-deep`-equivalent token or espresso ink; per-instance class updates across surfaces.
  4. **Hearts semantics**: heart track becomes `role="img"` + `aria-label="Friendship N of 5"`; empty-heart stroke token `#A89886` (≥3:1); same treatment in Journal People cards; kindred tier icon color → terracotta-deep.
  5. **Scroll reachability**: `tabIndex={0}` + `aria-label` on inner scroll containers (dialogue prose, history, gift picker, journal/satchel/station bodies).
  6. **Reduced-motion**: extend the `index.css` guard to `animate-pulse` (brew flame) and the scene veil transition; gate the tap-destination ring pulse behind the media query (scene-side boolean read once at init — no per-frame work).
  7. **Canvas semantics**: WebGL mount div gets `role="img"` + `aria-label="3D neighborhood view. Move with WASD or touch, press E to interact."`
  8. **Error boundary**: `role="alert"` on the SceneErrorBoundary card.
- **Acceptance**: tab cycle stays inside an open surface and returns to the trigger on close; computed contrast ≥4.5:1 on all filled buttons and ≥3:1 on all state glyphs; all five originally-failing checks pass; 44px floor and no-backdrop-filter rule untouched; canvas render loop untouched (attribute-only diff).

### WP4 — HUD & Onboarding Pack *(P1 · Effort S–M · Risk low)*
Fixes F4, F9, F11, F23, F24, plus label single-source (F16 partial).
- **Files**: `src/App.tsx`, `src/components/PauseModal.tsx` (shortcut list), `src/game/playerController.ts` + `src/scene/NeighborhoodCanvas.tsx` (label source consolidation only), `src/game/worldMap.ts` (label data only if needed), tests that pin CTA labels.
- **Scope**:
  1. **Intro tip rescue**: render the tip *above* the CTA (stacked column) instead of `nearestTarget ? CTA : tip`; dismissal moves to "first real interaction (interact key, dialogue open, or 12s)" — never on target presence. Teaches journal [J], satchel [I], and rest-at-bed in one two-line tip (copy kept minimal).
  2. **+2h mobile parity**: compact 44px icon-only variant visible below `sm:` (label via `aria-label`/`title`), no layout squeeze — the row already reserves space.
  3. **Journal unread badge**: HUD Journal button shows a terracotta dot + count when `newCounts` total > 0; computed on the existing save-stamp cadence (never per frame), from `buildPocketJournalView` output already produced for HUD-unread purposes — extracted into a tiny memoized helper in `journal.ts` (`countJournalUnread`).
  4. **CTA label single source**: export one `getPromptActionLabel(target)` used by both `playerController.ts` selection and the canvas duplicate ternary — eliminating the two already-drifted label engines ("Ring Bell" vs "Ring the Brass Bell"); promote hidden card verbs where they are the real action.
  5. **Seated-with-drink**: when seated with a sipable, the HUD offers both `Sip {drink}` and `Stand Up` (second, smaller button; walk/tap escape hatches unchanged).
  6. **Toast cadence**: minimum visible 1.6s, identical-string restart, simple 2-deep queue.
  7. **PauseModal shortcut card**: list the desktop shortcuts (WASD, E, J, I, G, M, Esc/P, Shift, wheel zoom) — makes the full control set discoverable at any time.
- **Acceptance**: fresh save shows the tip (data-testid still `intro-control-tip`); first interact dismisses it; `+2h` reachable at 390×844; journal badge appears after a memory lands and clears on open; both label engines emit identical strings (unit-pinned); seated players always see an exit; toast queue shows both of two rapid events.

### WP5 — Journal Coherence Pack *(P2 · Effort S · Risk low)*
Fixes F13, F14, F15 and the read-model hygiene part of the "New"-inflation issue.
- **Files**: `src/game/storage.ts` (reset hygiene), `src/game/journal.ts` (copy + entryKeys), `src/components/JournalDrawer.tsx` (labels only), tests in `journal.test.ts` / `storage.test.ts`.
- **Scope**:
  1. `resetWorldState` also clears `little_somewhere_journal_read_v1` (same tombstone-free path as world reset; read-state is derived cache, not journal data — no persistence loss).
  2. Copy: "The Quiet Gazebo Bell" aligned to the authoritative storyline title; spring intake copy made season-neutral ("leaves and silt clog the old stone intake" → spring-safe wording).
  3. Landmark read-keys keyed by landmark id + **category**, not volatile status label — status flips no longer re-raise "New" for already-read facts (bounded key volume unchanged).
- **Acceptance**: fresh world opens with accurate "New" markers only for genuinely new facts; spring Day-1 journal has no autumn references; bell storyline reads consistently; journal.test/storage.test suites green.

---

## 4. Deliberately Deferred Register (do not silently re-litigate)

| ID | Item | Why deferred | Trigger for revisit |
| :-- | :--- | :--- | :--- |
| D1 | Unified `ModalChrome` component + `openSurface` state-machine union | Behavior wins are achieved by WP1/WP3 without a 6-file structural refactor; extraction is best done once token tier-2 lands | Next milestone touching all surfaces simultaneously |
| D2 | Token tier-2 (derived tints) + discipline-test extension to `src/scene` | Large mechanical diff (~83 literals); zero player-visible benefit alone | Any future restyle/theming work |
| D3 | Mobile pinch-zoom | Gesture-vs-walk conflict needs dedicated QA surface; interiors auto-frame compensate | Next mobile interaction milestone |
| D4 | Desktop hover raycast affordance | Scene-layer pointer bookkeeping risks the zero-allocation/frame budget contract; needs its own perf review | Dedicated scene-interaction work package |
| D5 | Emergent story seeds surfaced in Stories tab ("Quiet Happenings") | Feature work (M) beyond this corrective program's surgical scope; derivation exists and is test-covered | LR-3+ narrative milestone |
| D6 | Gift-taste ledger persistence (learned tastes, migration v12) | Only schema-touching item; WP2 ships the safe UI half | First future migration bump |
| D7 | Living portrait expressions (emotion-reactive faces) | Asset-system work (M–L) in `DialogueVisuals` painters | Next character-identity pass |
| D8 | `JournalDrawer` decomposition into per-tab modules | Pure extraction; best after D1 so both share primitives | Refactor window |
| D9 | Unmet People card copy variation | Current boilerplate respects the non-omniscient knowledge boundary; variation risks leaking identity pre-introduction | Knowledge-model milestone |
| D10 | Naming truthing (`*Drawer`→`*Modal`, dead-code sweep) | Cosmetic; zero player impact | D1/D8 execution |

---

## 5. Verification & Release Protocol (all WPs)

Per AGENTS.md §4, every work package ships only after:

1. `npm test` — full suite green (595 baseline + any new label/badge/read-key pins).
2. `npm run lint` (`tsc --noEmit`) — 0 errors.
3. `npm run build` — green (EL-10 chunk warning unchanged).
4. `npx tsx scripts/check_layer_boundaries.ts` — clean.
5. Headless Chromium QA: desktop 1440×900 **and** mobile 390×844, fresh save + veteran save, **0 console / 0 page errors**, focused checks per WP:
   - WP1: journal-over-dialogue impossible; Esc top-most; toast visible over sheet; reset double-step.
   - WP2: history honesty; heart pulse (on + reduced-motion); prop eyebrow; gift hints.
   - WP3: keyboard-only traversal of every surface; focus restore; computed contrast spot-checks.
   - WP4: intro tip visible on fresh save; +2h on mobile; badge lifecycle; label consistency.
   - WP5: reset → journal correctly "New"; spring copy; bell title.
6. `WORKLOG.md` entry + `HANDOVER.md` addendum with as-built contracts.
