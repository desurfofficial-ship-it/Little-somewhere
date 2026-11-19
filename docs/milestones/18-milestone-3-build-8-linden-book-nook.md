# Milestone 3 Build 8 — Visitable Linden Book Nook (Nora's Paperbacks & Tea)

**Status**: COMPLETE & VERIFIED (2026-11-20)
**Base**: Milestone 3 Build 7 tree (`WorldState v8`, 182/182 tests)
**Authoritative scope source**: `GAME_DESIGN.md` §12.2 (`docs/milestones/17…md` list item 1)

## 1. Why this build is next

Build 7 proved the neighbor-interior pattern generalizes; `HANDOVER.md` names Linden Book
Nook (Nora) as the next remaining visitable interior. Nora's identity is **paperbacks &
tea** — a reading-corner ritual set distinct from the bakery's bake-and-share loop:
browsing → settling in → reading, with tea as the shared warmth. No new characters, no
currency, no collection pressure; the shelf rotates one featured book per day.

## 2. Implemented scope

### Game layer — `src/game/bookNook.ts` (new) + contracts

- Local-coordinate cutaway contract: `NOOK_BOUNDS` (-2.5..2.5 × -2.4..2.4), 4 obstacles
  (`nook_shelf` bookshelf wall, `nook_desk` lending desk, `nook_tea` tea console,
  `nook_chair` reading armchair), 4 stations + sliding movement + 6-hub waypoints +
  `selectBestNookTarget` (+ armchair-seat candidate). East-wall door ↔ exterior
  `nook_door` prop at (-11.8, -1.0), porch exit (-11.55, -1.0).
- One **indoor reading-armchair seat** reusing the sit-and-sip ritual.
- **Deterministic featured-book cycle** `getFeaturedBookForDay` (day % 4): *The Ivy
  Letters* → *Sketches of Mirror Pond* → *Bread & Bell: A Bakery Year* → *The Night
  Orchard* — each with its own one-time first-read memory (four quiet collectible
  memories across four days, no items created).
- Daily rituals: **browse the featured book** (+12m, booksRead per new book), **pour a
  reader's cup** (+6m, `chamomile_pear_tea` ×1, sipable), **read Nora's lending notes**
  (one-time starter tea + seasonal rereads, +8m).
- `WorldState v9`: `nookState` (6 day-stamp/counter fields), `migrateV8ToV9`,
  `sanitizeNookState` (booksRead clamps to 4), interior-aware spawn/walkability,
  save-revision sensitivity, `playerLocation += 'nook_interior'`.

### Scene layer — `src/scene/builders/bookNookInterior.ts` (new)

- Storybook cutaway: wood floor + reading rug, tall bookshelf wall (four shelf boards,
  ~53 tinted spines with leans, keepsakes), lending desk (oilcloth ledger with tea rings,
  brass pen, returned-book stack, desk lamp), tea console (copper kettle + stoneware
  cups + honey pot), deep reading armchair (quilt fold + **reactive open book** on the
  side table tinted by the featured book's shelf slot), floor reading lamp, east door
  with coat hook + scarf, morning window shaft, 20 paper-dust motes, **4 pooled tea
  steam puffs** gated on `teaSharedDay === day`.
- Zero-GC `update(world, phase, elapsed)`; dusk reading-lamp warm-up; tracked disposal.
- Exterior porch dressing (step stone, lantern, returned-books basket) + proxy.

### Dialogue, memories & journal

- `side_nora_reading_corner` (personal_story; !`nookVisited`): Nora's invitation;
  accepting sets `sideFlags.nookVisited` + durable memory.
- `daily_nora_nook_checkin` (daily_slice; `nookVisited` + notSeenToday): reacts only to
  her own nook's observable state (browsed today → names the book; tea poured; fresh
  cycle tease) — knowledge boundary identical to Clara/Mina check-ins.
- Player-only memories: per-book first reads, first reader's cup, lending ledger.
- Pocket Journal: `linden_book_nook` Discoveries row (`Nora's lamp-lit shelves` →
  `Reading: {book}` → `N of 4 books settled` → `Reader's tea poured`).

## 3. Protected systems

Same guarantees as Build 7: additive v8→v9 migration only, all prior interior contracts
bit-identical, no currency/genre drift, no new dependencies, no real-world-day mechanics.

## 4. Verification (executed 2026-11-20)

- `npm test` — **206/206 passing** (`0` failures; 182 Build-7 baseline + 17
  `bookNook.test.ts` + 5 `bookNookInterior.test.ts` + Nora dialogue gating + journal
  lifecycle; v6/v7 migration chain tests updated to assert the chained v9 result with
  all intermediate invariants preserved).
- `npx tsc --noEmit` — **0 errors**; `npm run build` — passing (pre-existing chunk-size
  warning unchanged, EL-10).
- Headless Chromium QA (`scripts/make_build8_save.ts`): door prompt `Step Inside[E]` →
  veil-enter → interior cutaway → `Browse the Bookshelf` → `The Ivy Letters` (+12m) +
  memory → reader's cup (+6m, `+1 Warm Chamomile Tea`) → lending notes (+8m, starter
  tea) → armchair `Sit` → `Sip Warm Chamomile Tea` → `Stand Up` → Pocket Journal
  `Discoveries` with `Linden Book Nook · Reading: The Ivy Letters` → door exit → reload
  persistence (`nookState` complete, 2 teas, 3 nook memories) → mobile 390×844 zero
  overflow, min control 44px → **0 console errors / 0 page errors** across all runs.
- UX note: standing between the tea console and the armchair shows whichever target the
  player faces (station-adjacency overlap, same behavior family as the cottage
  table-vs-stool pair); facing the chair offers `Sit on Reading Armchair`.
- Asset Source Note (Permanent Instruction 15): all Build 8 assets are **Option A —
  self-built procedural Three.js** (palette-keyed composite meshes, tracked-geometry
  cutaway room, pooled steam puffs, registry-derived prose). Option B Polyfork evaluated:
  no benefit — every prop is contract-bound to the nook registries, the book-cycle rig
  updates, and the v9 save schema. Options C/D not used; no external assets entered.
- Remaining limitations: residents never enter interiors; the shelf cycle is a fixed
  4-day rotation; `booksRead` caps at 4; the nook has no positional room-tone (interior
  audio stays cottage-only by design); Nora's check-in surfaces after quest-priority
  topics resolve (shared daily-slice design).
