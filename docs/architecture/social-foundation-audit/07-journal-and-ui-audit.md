# Social Foundation — Post-Integration Adversarial Audit
# 07 — Journal and UI Audit (SF-3 People-card chapter lines)

**Subject:** `JournalDrawer.tsx` (+6 lines), `journal.ts` (+13 lines), content source `deriveResidentChapter`.
**Method:** specialist static analysis (P1-E) + live browser QA by the parent auditor (agent-browser, shipped build served by vite, fresh save + one staged conversation).

## 1. Code-level verification (static)

- Diff surface: exactly one conditional `<p>` (JournalDrawer.tsx:665-669) inside the met-only fragment, between the personality block and the knownNotes block; zero reorders/removals. `journal.ts` changes purely additive (import, optional `chapter?: string`, one derivation call at :799, conditional spread at :817).
- Single render site (grep); no other `.chapter` consumers in `src/components`/`src/scene`; no search/collection tabs exist to leak into. Unmet residents early-return a card with no `chapter` key; conditional render handles absence.
- **Not persisted:** repo-wide grep — `chapter` appears nowhere in `storage.ts`/`migrations.ts`/WorldState; the sanitizer allow-list drops it structurally (hostile-attachment round trip byte-identical, doc 08 §2).
- **No leakage:** every chapter branch derives from player-known inputs (rift tie gated by `playerKnowsTie` matching the journal's own Clara–Arthur gate; visits = player-attended completions; keepsake = received-item state; feeling = the same chain the card already displays as `emotionLabel`; fallback = the player's own talk count). No `npc_social` content, no private memory text.
- Robustness: `deriveResidentChapter` returns `undefined` (never throws) for unknown id / deleted resident / all ledgers missing / `mood: undefined` (probe-verified). One latent throw vector (an id marked met in `world.residents` but absent from `RESIDENTS`) is unreachable through `buildPeopleList` (maps the closed `RESIDENT_ORDER` union); if it ever threw, `JournalDrawer` is **not** inside `SceneErrorBoundary` (wraps only `NeighborhoodCanvas`) — a root unmount/white-screen class. Likelihood negligible; hardening note.
- Performance: ≈ 24.8 µs per full 10-resident chapter sweep (rich world); rebuilds are interaction-paced (`commitWorld`), sim paused while the drawer is open — no staleness-while-open.
- Styling: the new `text-[#7A6A5B] italic` combination is used **once repo-wide**; the established muted token is `text-espresso-muted` (#6A5B50, ×18 in this file). Computed contrast of the new color on card-warm background: **4.44:1** — marginally below WCAG AA 4.5:1 for 12 px text (the token would give 5.56:1); it also skirts the BUILD-04 token-discipline test (passes only because the hex is not on the banned list). Apostrophe style mixes straight quotes (chapter strings) with the journal's curly-quote convention. P3 polish items.

## 2. Live browser QA (parent auditor)

Environment: shipped code at `07be49c` served by vite; fresh save; one conversation staged with Jun (choice → wave goodbye) to reach a chapter-bearing state.

| Check | Result |
|---|---|
| Desktop 1440×900 — game render | clean; zero console errors, zero page errors across the entire session (only vite/React-DevTools info messages) |
| Empty-journal class (fresh save, 0/10 met) | People tab renders 10 stub cards, **no chapter lines** (correct: unmet silence), two-column grid, clean layout |
| One-NPC-met class | Jun's card renders avatar, heart row (1/5), personality line, **chapter line "A face becoming a name — a few more conversations and Jun won't be a stranger."** in italic muted style at the designed position (between personality and the Acquaintance·Cheerful·Warming-up meta row), wrapping cleanly to two lines |
| Many-NPC class | 10 cards render; unmet cards unaffected by the met card's extra paragraph |
| Tablet 768×1024 | two-column grid maintained; chapter line wraps correctly |
| Mobile 390×844 | single-column stack; tabs wrap 2×2; chapter line wraps to two lines; no overflow, no clipping, no truncation classes needed |
| Repeated open/close + section navigation | Stories / Memories / People / Discoveries exercised repeatedly across the session — zero errors |
| Long-name/long-line class | max chapter length ≈ 92–95 chars (static bound: 12-visit tradition + longest activity title + 3-digit day); wraps freely; no fixed-height clipping on the card path |
| Stale-while-open class | sim paused while drawer open (dialogueOpen gate); in-drawer +2h button re-derives live — no staleness |
| Live sighting of R-04 (wrong-label copy) | **not observed** — requires a staged wistful-mood + met + non-low runtime-emotion state; statically verified by code-path analysis (doc 05 §8). Listed as the one residual QA unknown |

## 3. Findings

- **R-04 (P2)** — chapter copy can contradict its own trigger (documented fully in doc 05 §8; surfaced on the People card, so the UI is where it lands).
- **P3 batch** — one-off color token at 4.44:1 contrast (use `text-espresso-muted`); unprecedented `italic` (deliberate "whisper" cue — design confirmation recommended); straight-vs-curly apostrophe inconsistency inside one surface; "a kind word is still owed" tone nit (zero-FOMO constitution); chapter invisible to read-tracking (by design — "a whisper, not a log"; recorded so it is not mistaken for a bug); People cards are `<article>` in a plain grid rather than `<ul>/<li>` (pre-existing, acceptable).

## 4. Verdict (Journal/UI)

Clean, additive, boundary-safe, unpersisted, crash-unreachable, perf-negligible. One P2 (R-04, copy logic) and polish items. Nothing blocks LR-3.
