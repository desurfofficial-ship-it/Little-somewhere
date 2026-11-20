# Milestone 3 Build 9 — Visitable Copperwheel Cottage (Arthur's Brass Workshop)

**Status**: COMPLETE & VERIFIED (2026-11-20)
**Base**: rebased onto `origin/main` a94ca09 (Round 4 + Round 5 + Dialogue Modularization atop Build 8, `WorldState v9` -> `v10`) — Arthur's dialogue topics live in `src/game/dialogue/interiors/copperwheel.ts` after the modularization; golden snapshot re-baselined 77 -> 79 topics
**Authoritative scope source**: `HANDOVER.md` next-build list + `GAME_DESIGN.md` §12.2
("visitable neighbor interiors — Copperwheel, the last remaining visitable neighbor
interior, Arthur")

## 1. Why this build is next

Builds 7 and 8 proved the neighbor-interior pattern generalizes (bake-and-share, then
browse-and-read). `HANDOVER.md` names Copperwheel Cottage — Arthur, the Clockmaker &
Tinker — as the last remaining visitable neighbor interior. Arthur's identity is
**patience & small mends**: one bench project rests on the felt each day, the copper
kettle keeps his beloved chamomile warm, and the mending ledger remembers every clock
that came back to ticking. No new characters, no currency, no collection pressure; the
ritual set is distinct from the bakery's bake-and-share and the nook's browse-and-read.
Established lore anchors: "brass escapements and chamomile tea" (favorite thing), the
postcard quest ("Arthur at Copperwheel Cottage will know how to pin it back in place"),
the Silent Gazebo Bell rift, and Jun's drifting pocket watch ("ask Arthur at Copperwheel
Cottage" — `storylines.ts`).

## 2. Implemented scope

### Game layer — `src/game/copperwheel.ts` (new) + contracts

- Local-coordinate cutaway contract: `COPPERWHEEL_BOUNDS` (-3.0..3.0 × -2.5..2.5), 5
  furniture obstacles (`cw_bench` clockmaker's workbench, `cw_bed` bed alcove +
  nightstand, `cw_shelf` mended-pieces shelf & drawers, `cw_stove` copper kettle stove,
  `cw_chair` window armchair), 5 stations + sliding movement + 6-hub waypoints +
  `selectBestCopperwheelTarget` (+ armchair-seat candidate). South-wall door ↔ exterior
  `copperwheel_door` prop at (13.1, -7.85) with porch exit (13.1, -7.6).
- **Deterministic bench project cycle** `getProjectForDay` (day % 4): *The Orchard
  Pendulum* (crabwood clock for the Fern Hollow gate — Rowan) → *A Music Box Comb*
  (Barnaby's cedar music box) → *The Watch Escapement* (Jun's courier pocket watch) →
  *bench rest* (rolled felt, oiled drawers). Each project carries its own one-time
  memory (four quiet collectible memories across four days, no new items).
- Daily rituals (once per in-game day each): **check the workbench & help with the fine
  work** (+10m working days, winding session counted; +8m on rest days), **pour a
  chamomile cup** at the copper kettle (+6m, `chamomile_pear_tea` ×1, sipable),
  **read the mending ledger** (one-time starter tea + seasonal rereads, +8m), and the
  cottage-style **peek at the nightstand** (+4m inspect; the railmen's regulator watch
  stopped at a quarter past four, one-time memory).
- One **indoor window-armchair seat** reusing the sit-and-sip ritual.
- `WorldState v10`: `copperwheelState` (8 day-stamp/counter fields), `migrateV9ToV10`,
  `sanitizeCopperwheelState` (projectsAdmired clamps to 4), interior-aware
  spawn/walkability validation, save-revision sensitivity, `playerLocation +=
  'copperwheel_interior'`, `advanceToNextDay` porch wake-out. `resolveAnySeatById`
  now spans five seat registries.

### Scene layer — `src/scene/builders/copperwheelInterior.ts` (new)

- Storybook cutaway: dwarf-stone plinth + plank floor + lavender workshop rug, tall
  north wall (workbench pegboard, bed alcove) + tall west wall (mended shelf, tall
  window with chamomile sill pot), cutaway south (door + armchair side) + east
  wainscot (stove flue rising into the header beam). **Clockmaker's workbench** (maple
  top, iron vise, gear tray, felt mat, hanging loupe, tool pegboard), **reactive day
  project group** (pendulum case with swinging rod on checked days / open music box
  with brass comb / pocket watch on a stand / rolled felt + tool roll), **bed alcove**
  (iron frame, quilt, nightstand regulator watch, framed photo, wall lamp), **mended
  shelf** (three boards of tiny clock cases, brass-pull drawers, open ledger), **copper
  kettle stove** (fire door, kettle + cups, visitor's card, flue), **window armchair**
  (quilt + footstool + throw), interior door (brass knob, letter slot, mat, wall
  lantern), hanging bench lamp, morning window shaft, 24 brass-dust motes, **4 pooled
  kettle steam puffs** gated on `teaSharedDay === day` — zero-GC
  `update(world, phase, elapsed)`, dusk lamp warm-up, tracked disposal.
- Exterior porch dressing (brass-edged doormat, clock-parts repair crate with a waiting
  case, lean-to A-frame sign) at the existing south door; the wall lantern is the
  pre-existing `buildArthurPorchLampRig`.

### Dialogue, memories & journal

- `side_arthur_workshop_bench` (personal_story; requiresMet + !`copperwheelVisited`):
  Arthur's invitation (winter / bell-restored / default variants); accepting sets
  `copperwheelVisited` + durable workshop-opened memory; steady-hand branch.
- `daily_arthur_workshop_checkin` (daily_slice; `copperwheelVisited` + notSeenToday):
  reacts only to his own workshop's observable state (helped today → names the project;
  bench-rest tease; kettle thanks; cycle tease) — knowledge boundary identical to
  Clara/Mina/Nora check-ins.
- Player-only memories: per-project firsts, first kettle cup, mending ledger, the
  regulator's watch, plus the shared sit-and-sip tea memory.
- Pocket Journal: new `copperwheel_cottage` Discoveries row (`Arthur's brass workshop`
  → `At the bench: {project}` / `Bench resting today` → `N of 4 projects admired` →
  `Helped at the bench` → `Tea shared at the kettle`).

### Cross-build defects found and fixed during QA

1. **`copperwheel_door` was missing from `PROP_INTERACTABLES`** — the exterior door
   prompt could never fire; added with an interior focus point (`worldMap.ts`).
2. **Indoor sitting never persisted** (`migrations.ts` sanitizer) — the save sanitizer
   resolved `playerSeatId` through the outdoor-only `getSeatById`, so sitting at ANY
   indoor seat (cottage stools since 2C, café chair, reading armchair) silently degraded
   to standing on every save/load. The sanitizer now resolves across all five registries
   with interior/exterior pairing enforced (regression test added).
3. **The sit-and-sip ritual refused every non-cottage interior** (`actions.ts`
   `sipBeverageAtTableAction`) — a Pass-5 leftover hard gate to `cottage_interior`, so
   the Build 7/8 indoor seats advertised "Sip" but silently refused it. The ritual now
   works at any indoor seat with seat-aware prose (`Tea at the Window Armchair`) while
   still refusing exterior/indoor-seat corruption pairings (regression test added).
4. **Software-WebGL fence stall** (`NeighborhoodCanvas.tsx` `afterDraw`) — headless
   SwiftShader occasionally never signals `SYNC_GPU_COMMANDS_COMPLETE`, deadlocking the
   whole render loop on the fence poll. A 250 ms wait budget degrades pacing gracefully
   instead of freezing the game (also protects real software-GL players).
5. **The Copperwheel west window glass/trim was buried inside the wall slab** — moved to
   the inner wall face so the window reads from inside.

## 3. Protected systems

Same guarantees as Builds 6-8: additive v9→v10 migration only, all prior interior
contracts bit-identical, no currency/genre drift, no new dependencies, no real-world-day
mechanics, no new inventory items (the kettle pours the existing `chamomile_pear_tea`).

## 4. Verification (executed 2026-11-20)

- `npm test` — **250/250 passing** (`0` failures; the 223-suite post-Round-5 baseline
  + 19 `copperwheel.test.ts` + 5 `copperwheelInterior.test.ts` + Arthur dialogue gating
  + `copperwheel_cottage` journal lifecycle + the migration-chain tests updated to
  assert the chained v10 result with all intermediate invariants preserved; the
  `dialogueRegistry` golden snapshot re-baselined to 79 topics with the pre-existing
  77 ids in unchanged order).
- `npx tsc --noEmit` — **0 errors**; `npm run build` — passing (pre-existing
  chunk-size warning unchanged, EL-10).
- Headless Chromium QA (`scripts/make_build9_save.ts` door/inside QA saves; injection
  per the documented single-encoded + flush-neutralizing pattern): exterior porch
  dressing + `Step Inside[E]` → veil-enter → HUD `Copperwheel Cottage · Indoors` →
  interior cutaway (workbench + pegboard + loupe, bed alcove + regulator watch, mended
  shelf, kettle stove with steaming kettle after pouring, armchair, pendulum project on
  the felt) → bench card `Today's project: The Orchard Pendulum (+10m)` + memory →
  kettle `+1 Warm Chamomile Tea` → ledger starter tea → nightstand memory → walk to the
  armchair → `Sit on Window Armchair` → **`Sip Warm Chamomile Tea` consumed the cup and
  saved `A Quiet Warm Chamomile Tea Moment`** (the cross-interior sip fix verified live)
  → Pocket Journal `Discoveries · 10` with the `Copperwheel Cottage` row → door exit →
  reload persistence (`copperwheelState` complete, memories intact, interior location
  preserved) → Arthur check-in topic fires live and reacts to the used kettle → mobile
  390×844: door prompt, interior loads, `scrollW 390 === innerW 390` (zero overflow),
  0 sub-44px controls → **0 console errors / 0 page errors** across clean sessions.
- Asset Source Note (Permanent Instruction 15): all Build 9 assets are **Option A —
  self-built procedural Three.js** (palette-keyed composite meshes, tracked-geometry
  cutaway room, pooled steam puffs, registry-derived prose). Option B Polyfork
  evaluated: no benefit — every prop is contract-bound to the Copperwheel registries,
  the day-cycle rig updates, and the v10 save schema. Options C/D not used; no external
  assets entered the build.
- Remaining limitations: residents never enter interiors (consistent with all
  interiors); the bench cycle is a fixed 4-day rotation; `projectsAdmired` caps at 4;
  no positional room-tone inside the cottage (interior audio stays cottage-only by
  design); Arthur's check-in/invitation surface after quest-priority topics resolve
  (shared daily-slice design — the Silent Gazebo Bell quest outranks them until it
  resolves).
