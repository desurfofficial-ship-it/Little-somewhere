# BUILD 03 — Progression-to-Visual Specification & Environmental Memory Design (Design Lock, rev 2)

**Companion to**: `build03-01-phase5-requirements-audit.md` (requirements + deviations A1–A8). This document fixes the architecture, interfaces, file ownership, and per-feature design before implementation.

**Rev 2 — independent adversarial design review applied (13 required changes, APPROVE-WITH-CHANGES verdict)**: (1) season-drift re-based so `dayOfSeason 1` is byte-equal to today's look in all four seasons and drift departs from it; (2) revision packing re-specified as radix-sum Number arithmetic (2^53-safe, no bitwise truncation); (3) ownership table extended (`botanicalDressing.ts`, interior builders, veteran-save generator); (4) pier sconces re-specced as two new short hooded sconce posts at the shore step / pier head — the stub pilings cannot carry them and the existing pier lantern is never touched; (5) herb crate re-anchored to hang under the ledge lip between the corbels (display ledge is fully occupied by loaves/rolls/price card); (6) drift application pinned to the revision-gated static block (the season block only fires on season change) with grove AND wilds crowns drifting together; (7) 5.6b pinned to `windowMaterials` only, never `willowWindowMaterials`; (8) exploration coordinates corrected to the builder constants; (9) noticeboard glint defined as emissive **color** on per-pin clones, newest = highest-index visible flyer; (10) empty-token cheap path for allocation discipline; (11) perf census re-stated honestly with per-group `contactBatchRoot` accounting; (12) caddy offset pinned, outcome enums clamped to hydrate fallbacks, optional `storylines` OR-fallback, v5→v6 echo asymmetry documented; (13) Jun charm pinned to the mailbox post (never the animated `flagMesh`), watch charm parented to the non-seasonal porch-lantern rig.

---

## 1. Environmental memory — the four layers (and why they are not new state systems)

Every visual decision in LITTLE SOMEWHERE already belongs to exactly one of four layers; BUILD 03 makes the mapping explicit and adds **no fifth system**. The layers are a reading aid for reviewers, not a runtime structure.

| Layer | Owns | Existing mechanisms (unchanged) | BUILD 03 additions |
| :--- | :--- | :--- | :--- |
| **L1 — Permanent identity** | What a place IS | Building silhouettes, archetype casts, material families, porch season groups, interior dioramas | None (untouched) |
| **L2 — Persistent history** | What HAPPENED here (saved state) | Story-flag prop groups (`environmentRenderer.ts:205–286`), orchard outcome diorama, cottage mementos, `worldProps` placements | 5.1 storyline props, 5.2 tokens + keepsake echoes, 5.4 exploration marks, 5.5 memento tiers — all **derive from persisted state**, therefore persist by recomputation |
| **L3 — Current activity** | What is happening NOW | Day-stamped interior rituals (bake/book/bench/crop), `npcTouches` (pastry basket, greenhouse stage, flyer count), resident anim states, encounters | Nothing new — audited only |
| **L4 — Temporary atmosphere** | Weather/light/season-of-the-moment | Time-of-day curves, weather particles + puddles, seasonal tints, lantern schedule | 5.3 within-season drift (a refinement of the existing seasonal tint), 5.6b late warm windows (a curve refinement) |

Ownership rule preserved: L2 changes require a **persisted state edge**; L3/L4 changes derive from `minuteOfDay`/`day`/`weather` and never write anything. A visual may never claim L2 history without a persisted flag/count behind it (the "no fake progression" law).

## 2. Technical architecture

### 2.1 New game-layer derivation module (pure, additive, zero simulation impact)

**File**: `src/game/progressionVisuals.ts` (+ `src/game/progressionVisuals.test.ts`).

```ts
export interface ProgressionVisualState {
  revision: number;            // deterministic integer; changes iff any derived signal changes.
                               // Radix-sum packing (Number arithmetic, max < 2^53) — NEVER bitwise shifts,
                               // which silently truncate at 32 bits (review finding H1). Collision-freedom
                               // is pinned by the determinism test (each signal toggles the integer).
  storylineProps: {            // 5.1 — each: visible + outcome enum for tint/variant
    zineChalkboard: boolean; zineTheme: ZineTheme | null;
    herbWindowCrate: boolean; herbStyle: HerbStyle | null;
    musicStand: boolean; standStyle: StandStyle | null;
    watchCharm: boolean; watchStyle: WatchStyle | null;
    pierSconces: boolean; sconceOutcome: LanternOutcome | null;
  };
  residentTokens: ResidentToken[];   // 5.2a/b — { residentId, kind: 'friend_charm' | 'kindred_ribbon' }
  keepsakeEchoes: { residentId: ResidentId; itemId: PersonalItemId }[]; // 5.2c
  seasonDrift: { dayOfSeason: number; canopyProgress: number; meadowProgress: number; posyStage: 0 | 1 | 2 }; // 5.3
  explorationMarks: { wellRibbon: boolean; riseCairn: boolean; laneArrow: boolean; hiveWreath: boolean }; // 5.4
  mementoTiers: { bookStackTier: 1 | 2 | 3; honeyDipper: boolean; recipeCardTier: 1 | 2 }; // 5.5
  housekeeping: { noticeboardGlint: boolean }; // 5.6a (5.6b rides the existing time curve, not this state)
}
export function composeProgressionVisualState(world: ProgressionWorldInput): ProgressionVisualState;
```

- `ProgressionWorldInput` is a `Partial<Pick<WorldState, ...>>` (sideFlags, playerRelations, neighborGiftsReceived, day, season, cottage/greenhouse/bakery/nook state, worldEvents, **and optional `storylines`**) — same style as `composeEnvironmentState`'s Pick; all new fields optional with safe defaults so every existing call site and test fixture keeps compiling.
- **Storyline OR-fallback** (review L1): each 5.1 gate is `sideFlags.<completed-flag> === true || storylines[id].status === 'completed'` so hand-built QA saves (e.g. the BUILD 01 veteran generator, which completes storylines without syncing sideFlags) light the props too. Real saves cannot hit the gap (the sole completion writer `advanceStorylineInPlace` always syncs; migration always re-hydrates), but the fallback costs nothing and removes the trap.
- **Outcome-enum clamping** (review M8): unknown/missing outcome strings clamp to the same fallbacks `hydrateStorylinesFromLegacyState` uses (`classic_edition`, `plaza_table`, `carved_clef`, `steady_route`, `bridge_compromise`) — pinned in tests.
- **Allocation discipline** (review M5): when no tokens/echoes are earned the fields are module-level frozen empty arrays (the common case), so the per-frame compose (it runs every frame inside `composeEnvironmentState`) adds no garbage in a fresh save; the grown-state arrays are rebuilt only when their input signature changes (cheap membership compare against the last state).
- **Pure**: reads only, mutates nothing, deterministic — identical world → identical output (test-pinned).
- `revision` packs booleans/enums/threshold buckets into an integer (day bits included so daily drift re-applies). **No changes to the existing `environment.ts` revision packing** (deviation A1).

### 2.2 Wiring (single source, revision-gated)

1. `environment.ts`: `composeEnvironmentState` gains an **additive** field `progression: ProgressionVisualState` computed by delegating to `composeProgressionVisualState`. Input Pick widened additively (all optional).
2. `environmentRenderer.ts`: the static block's gate becomes `lastStaticRevision !== composed.revision || lastProgressionRevision !== composed.progression.revision`. Inside the block, the new rig group is toggled by the derived signals. **Drift application point** (review M1): the 5.3 canopy/meadow drift lives in THIS revision-gated static block (the season block only fires on season change and would freeze drift at its day-1 value for days 2–10); on a season-change frame the drift write is ordered **after** the season-block write (season block is section 1, static block section 2 — the existing order already guarantees this; pinned by a test that changes season and dayOfSeason together). Both `groveRig` crowns **and** the `wildsRig` crowns drift together (review M1) so the two tree populations never diverge. 5.6a applies in the same block; 5.6b is a per-frame curve refinement in the time-of-day block.
3. `NeighborhoodCanvas.tsx`: rigs built once at mount (before `flushStaticContactShadows` so static discs batch), registered in `EnvironmentRendererDeps`, disposed in the existing cleanup chain.
4. `cottageInterior.ts`: memento tiers (5.5) + posy stage (5.3c) + keepsake echoes that live indoors are built by the cottage rig and toggled in its per-frame update behind a `last*` edge slot (existing interior pattern).

### 2.3 New scene-layer module

**File**: `src/scene/progressionPresentation.ts` (+ test). Contract identical to `reactiveProps.ts`/`orchardMicroLife.ts`: `{ group, apply(state), dispose() }`, zero per-frame allocation, `isSoftwareGl` budget respect, palette-owned materials, static discs via `addStaticContactShadow` registered pre-flush with `contactBatchRoot` where visibility toggles.

Builder inventory (all pre-built hidden at mount; hidden groups cost zero draw calls):

| Group | Meshes (merged where noted) | Materials |
| :--- | :--- | :--- |
| `zine_board` chalk cover + caddy | ≤4 (cover plane + caddy body/chalks merged) | palette timber-dark/plaster + 1 chalk-face material whose color = edition tint |
| `herb_crate` | ≤5 (crate merged; 2 hanging bunch variants toggled by style) | palette timber + foliage family |
| `music_stand` | ≤4 (stand merged; clef vs brace variants toggled) | palette timber |
| `watch_charm` | ≤3 | palette brass (existing metal tier) |
| `pier_sconces` ×2 | ≤6 total (hood + cage + flame each; outcome tint = shared cloned emissive material) | brass + lantern glass (cloned for tint) |
| `resident_tokens` ×10 charms + ×10 ribbons | ≤2 / ≤3 each | palette fabric/wood + marigold fabric color |
| `keepsake_echoes` ×5 | ≤2 each | match cottage shelf keepsake materials |
| `exploration_marks` ×4 | ≤3 each | palette stone/timber + chalk/ribbon accents |
| `memento_tiers` (cottage interior) | ≤4 | match existing memento materials |
| `sill_posies` | ≤2 | palette foliage |

Honest census (review M6): with every signal earned the design builds ≈100 small meshes across ~30 groups, of which a veteran save shows roughly 40–70 visible meshes at once (frustum culling reduces further at runtime). Every toggling outdoor group that carries a contact disc gets `userData.contactBatchRoot = true` so its disc batch follows its visibility (an unmarked group's disc would land in the scene-level bucket and show as a floating shadow when the prop hides — fresh-save-visible bug). Static contact discs are **dropped** on tiny elevated tokens (charms/ribbons/watch charm — no ground contact) and kept for the 5 storyline props + 4 exploration marks. Fresh-save draw delta: **0** (all groups hidden). Budget law unchanged: net ≤ measured BUILD 01 baseline 2,242 with named offsets at measurement time (report §Performance).

### 2.4 File ownership (prevents overlapping edits)

| File | Change class | Owner |
| :--- | :--- | :--- |
| `src/game/progressionVisuals.ts` (+test) | NEW — pure derivation | BUILD 03 |
| `src/game/environment.ts` | Additive delegation + Pick widening (optional fields only) | BUILD 03 |
| `src/scene/progressionPresentation.ts` (+test) | NEW — rigs + apply + dispose | BUILD 03 |
| `src/scene/environmentRenderer.ts` | Gate extension (one condition), static-block toggles, drift + glint + late-window curve | BUILD 03 |
| `src/scene/NeighborhoodCanvas.tsx` | Mount + dispose wiring (minimal, mirrors reactive-rigs pattern) | BUILD 03 |
| `src/scene/builders/cottageInterior.ts` | Tier groups + posy stage in existing update() | BUILD 03 |
| `src/scene/builders/bookNookInterior.ts`, `greenhouseInterior.ts`, `copperwheelInterior.ts` | Keepsake echoes on the giver's own counter/shelf/bench (review H2b — interiors are separate rigs; the echo must live where the item honestly belongs) | BUILD 03 |
| `src/scene/builders/botanicalDressing.ts` | **Additive** `setSeasonDayProgress(p)` on the existing meadow rig — the re-tint must live where the instance colors and the placement snapshot live (review H2a); progress 0 restores the placement snapshot bit-identically (the proven `setSpringSpread` pattern) | BUILD 03 |
| `scripts/make_build03_veteran_save.ts` (+qa harness) | NEW — Phase-5 full-progress veteran save generator: sideFlags ×5 with outcome variants, `neighborGiftsReceived` ×5, affinity ≥90 ×2 / ≥60 ×3, exploration flags ×4, counters ≥ tiers (review H2c). The BUILD 01 generator stays untouched as a historical artifact | BUILD 03 |
| `src/scene/builders/*` (all others) | **Untouched** — outdoor anchors are world-space placements owned by the new module, or parented to named existing nodes (orchard ladder rail `orchard.ts:376–387`; mailbox **post**, never the renderer-animated `flagMesh` — review L6; porch-lantern non-seasonal rig parent — review L7) | — |
| `src/game/*` (everything else) | **Untouched** — zero reducers/tick/schema | — |

## 3. Feature design (final)

### 3.1 Storyline world props (5.1)

| Prop | Exact gate (sideFlags) | Outcome variants | Placement (scene anchor) |
| :--- | :--- | :--- | :--- |
| Zine chalk cover + caddy | `pipZinePrinted` (OR storyline completed) | cover chalk face tint + tiny motif per `pipZineTheme` (art = carp-and-lantern sketch strokes; kitchen = rosemary sprig; classic = fountain doodle) | Noticeboard side rail (board group, `landmarks.ts:813–897` zone); caddy pinned at a fixed offset on the board's non-approach side, tested against the plaza lane edge and the board's approach vector (review M7; board obstacle = circle r 0.75 at (4.4, −3.2)) |
| Herb window crate | `herbLoafShared` (OR storyline completed) | hanging bunches per `herbLoafStyle` (plaza_table → marigold+thyme; tea_basket → chamomile+rosemary) | **Hung under the ledge lip between the corbels** (review H4 — the display ledge top is fully occupied: 3 loaves, 2 rolls, price card on a 1.35 u shelf; no-overlap list pinned in tests), clear of window interactables |
| Cedar music stand | `pondStandBuilt` (OR storyline completed) | `carved_clef` → clef inlay lip; `weatherproof_oak` → oak brace + page clip | Mirror Pond south bank beside `seat_pond_south` (1.8, 19.3), offset ≥ 0.45 u from seat approach, clear of bench volumes and nav edges |
| Brass pendulum charm | `watchTuneFinished` (OR storyline completed) | lower weight per `watchTuneStyle` (steady_route → envelope tag; patient_repair → teacup bead) | Parented to the **non-seasonal porch-lantern rig parent** (lantern base ring y≈1.55 at (14.05, −8.42), `reactiveProps.ts:241–291`) — never inside a seasonal porch sub-group (review L7) |
| Pier sconces ×2 | `lanternConflictResolved` (OR storyline completed) | `bridge_compromise` → both hooded, warm amber downward; `gentle_space` → **the new sconces stay dark** (the existing pier lantern is never altered — review H3); `public_harmony` → both lit, softer warm | Two **new short hooded sconce posts as world-space props** at the shore step / pier head edges (review H3 — the stub pilings are 0.07 r × 0.42 h and cannot carry them; the only lantern-height post already carries the pier lantern), clear of deck planks, mooring post, lantern post, sailboat and pond-skip ledge |

All five respect: no new collision (walkability test), clearance law from interactables, silhouette read at gameplay distance, contact discs batched.

### 3.2 Relationship tokens + keepsake echoes (5.2)

Anchor table (per-resident, fixed in `progressionPresentation.ts`, each validated against walkability + clearance):

| Resident | Friend charm (≥60) | Kindred ribbon (≥90) | Keepsake echo (gift received) |
| :--- | :--- | :--- | :--- |
| clara | Bakery windowsill (façade) | Bakery porch post | (—) clara is not a gift-reward resident |
| pip | Bakery upstairs sill | shared bakery porch corner | willow_zine_copy → Nook counter |
| arthur | Workshop porch post | Workshop porch post (double knot) | brass_pocket_bell → workshop bench |
| mina | Greenhouse door frame | Greenhouse porch post | woven_herb_wreath → greenhouse shelf |
| nora | Book Nook porch post | Book Nook post (double knot) | willow_zine_copy co-echo → Nook counter |
| barnaby | Woodshop doorframe | Woodshop porch post | cedar_music_box → woodshop bench |
| rowan | Orchard ladder rail | Orchard fence post | (—) not a reward resident |
| sora | Tea-cart side rail (clear of proxies) | Cart canopy post | (—) not a reward resident |
| toby | Pond south rail near bench | Pond rail post | pond_watercolor_card → pond rail easel spot |
| jun | Post-lane mailbox post | Mailbox post (double knot) | (—) not a reward resident |

Charm vocabulary (small, handmade): flour-dusted rolling-pin hook (clara), pressed-flower glass disc (mina), carved wood bead string (barnaby), ribbon book thong (nora), tiny brass gear (arthur), cedar apple (rowan), paint-brush tuft (toby), mail-tag charm (jun), chalk stub (pip), tiny jingle bell on cord (sora). Kindred ribbon = marigold bow (2 loops + knot), visual rhyme with the festival ribbon.

### 3.3 Within-season drift (5.3) — day-1 parity convention (review C1, binding)

**The convention**: `dayOfSeason 1` is **byte-equal to today's look in all four seasons**; drift *departs* from that anchor as the season ages (peak = day 10); winter never drifts (identity). This is the only reading that satisfies Doc 07 §7.3 fresh-save parity for every season (the existing autumn capture days 21–30 include day-of-season 1 AND later days — the autumn baseline captures used day 21 = dayOfSeason 1, so day-1 parity keeps those captures honest, and later days are the new, intended drift).

- `canopyProgress` = (dayOfSeason − 1) / 9 ∈ [0,1]. Drift targets are **explicit new constant hexes** in `progressionVisuals.ts` (authored once, cited here): spring drifts from the current no-tint anchor (`#FFFFFF`, which shows the authored crown base) toward a gentle bud-to-leaf deepening; summer from `#ECFAEA/#FFF6D8` toward a fuller warm green; autumn from `#E8B878/#E5975E` toward a deeper turn (single direction for all seasons — departure from day-1 anchor). Winter: identity.
- `meadowProgress` same scalar; `meadowDressing.setSeasonDayProgress(p)` re-tints the existing instanced clover/grass/blossom layers between the day-1 placement colors (progress 0 = **bit-identical snapshot restore**, the proven `setSpringSpread` mechanism) and per-season late keyframes. Zero new geometry/draws.
- Posies: **stage 0 = the new posy group fully hidden** (days 1–2 nothing new exists — parity), few stems at day ≥3 (stage 1), full at day ≥7 (stage 2); winter = 0.
- Parity tests: day-offset saves for all four seasons — dayOfSeason 1 renders identical material colors to the pre-BUILD-03 values; days 4/8 render the drifted targets (all-season day-offset parity, review C1).
- Application point: the revision-gated static block, ordered after any season-block write (see §2.2); grove AND wilds crowns drift together.

### 3.4 Exploration marks (5.4) — corrected builder-constant coordinates (review M3)

Children-first, no glitter: survey ribbon on the Old Stone Well coping (well at **(−21.4, 19.0)**, `wilds.ts:384`), **stacked-stone cairn with a tied survey ribbon** beside the Foxglove Rise lookout deck approach (rise group at **(21.4, 19.2)**, `wilds.ts:125` — deliberately distinct from the pre-existing Bee Line cairn at (8.2, −19.9) so "discovered" reads uniquely), chalk arrow on the Marigold Lane signpost board (**(21.5, 0.8)**, `wilds.ts:677`), sprig wreath on the wild bee log face (**(11.0, −19.7)**, `wilds.ts:724`). Each ≤3 merged meshes, gated on its `explored_*` flag, placed off the walkable path edges (walkability-tested).

### 3.5 Memento tiers (5.5) — reachable thresholds (deviation A2/A3)

- Book stack: base book (`booksRead > 0` existing) + 2nd at ≥2 + 3rd at ≥4.
- Honey crock: existing memento + dipper at `greenhouseState.totalHarvests ≥ 3`.
- Recipe card: existing card + 2nd card at `kneadingSessions ≥ 5`.

### 3.6 Housekeeping signals (5.6)

- Noticeboard glint (review M4): `noticeboardUpdated` → the **newest visible flyer** (= highest-index visible flyer, `environmentRenderer.ts:276–279`)'s brass pin gains a glint. Implementation: **per-pin cloned materials (3 clones, cheap)** so the glint *moves* when flyerCount changes 2→3; the clone carries an emissive **color** (warm amber, ≈`#f2c26b`) with intensity 0.9 — the shared `brassMat` has no emissive and a black-emissive clone would render nothing. Persistent glint, not one-day pulse (deviation A5); consciously framed as "the board has fresh news" décor in the report.
- Late warm windows (review M2): at `cozyLateNightHint` (minute ≥ 1260) the **`windowMaterials` pool only** gains a +0.2 warm emissive step, applied per-frame in the time-of-day block (minute 1260 crosses without any revision change). **Never `willowWindowMaterials`** — that pool is exclusively owned by the non-revision-gated hearth-truth section and would fight it every frame. **Verify-first**: capture 20:45 vs 21:15 before shipping; if the 30-minute tail proves invisible in capture, record the verification and skip.

## 4. Location identity audit (compact inventory — where each BUILD 03 feature lands)

| Location | Existing identity strengths | Weakness (pre-BUILD 03) | BUILD 03 addition | Deferred opportunities |
| :--- | :--- | :--- | :--- | :--- |
| Sunlit Fountain Plaza | fountain/bell/festoon arcs fully expressed | storyline history invisible | zine chalkboard (Pip/Nora's arc lived here), Sora charm + ribbon at cart side | none needed |
| Hearth & Crumb Bakery | bake roster, reconciliation tables | no memory of the herb-loaf arc | herb window crate, Clara charm, Pip charm | — |
| Copperwheel Cottage | oriel, porch seasons, project cycles | watch arc invisible | pendulum charm, Arthur charm + ribbon + bell echo | — |
| Linden Book Nook | featured book cycle, occupant rig | zine arc invisible | zine copy echo on counter, Nora charm/ribbon | — |
| Sunbeam Greenhouse | crop stages, stage rig | Mina's care invisible | Mina charm/ribbon + wreath echo | — |
| Pinecone Woodshop | dormer, bench projects | Barnaby's ties invisible | Barnaby charm/ribbon + cedar dish echo | — |
| Mirror Pond | hollow oak glint, music-stand arc site, lantern conflict site | both arcs invisible | cedar music stand, pier sconces ×2, Toby charm + card echo | — |
| Fern Hollow Orchard | gathering diorama | Rowan's identity thin | Rowan charm/ribbon | — |
| Post Lane (Jun) | mailbox flag only | Jun invisible | Jun charm/ribbon at mailbox post | — |
| Wilds ×4 | seats + discovery memory rows | discovered landmarks unmarked | 4 exploration marks | — |
| Willow Step Cottage | 5 mementos + keepsake shelf | counters had no growth read | memento tiers + sill posies | cottage proxy normalization (BUILD 02 deferred item, untouched) |

## 5. Compatibility & testing contract (binding)

1. **No save-schema impact**: derived-only; old saves (v1–v11) load unchanged; `sanitizeWorldState` untouched.
2. **Fresh-save parity (Doc 07 §7.3)**: explicit test — `composeProgressionVisualState(createFreshWorldState())` yields every signal false/zero/tier-1, and the scene `apply()` leaves every new group `visible === false`; capture pair proves visual identity with pre-BUILD-03 baseline.
3. **Determinism**: same world → identical `ProgressionVisualState` incl. `revision` (pinned).
4. **Reversal**: thresholds re-derive downward correctly (affinity/clamp edge tests).
5. **Save/load round trip**: veteran world → `serializeWorldState` → `loadWorldState` (migration path) → identical signals; re-entry/idempotence: applying the same state twice changes nothing (test).
6. **Walkability + clearance**: every outdoor placement tested against `isPointWalkable` and the 0.4–0.45 u interactable clearance; bench/seat volume exclusion for the music stand; interaction proxies unchanged (raycast parity tests stay green).
7. **Material law**: palette cache never mutated; tinted variants use per-group clones; zero per-frame allocation; disposal via the cleanup chain.
8. **Performance**: draw-call net ≤ measured BUILD 01 baseline (2,242) with named offsets; programs delta ≤ +2; geometries tracked; SwiftShader captures + real-GPU limitation documented.
9. **All 447 pre-existing tests stay green, unmodified.**

## 6. Adversarial review record

- Independent adversarial design review executed before implementation (Specialist F, read-only, evidence-cited): verdict **APPROVE-WITH-CHANGES**; 13 required changes, all applied in rev 2 of this document (see changelog at the top). Findings C1 (season-drift parity), H1 (32-bit packing overflow), H2 (ownership gaps), H3/H4 (impossible anchors), M1–M8, L1–L8 are incorporated as marked inline (review CX/HX/MX/LX tags).
- Remaining review obligations for the FINAL review loop (Stage 7): implementation-vs-spec conformance, fresh-save parity captures, save/load round trip, per-frame allocation audit, draw-call budget reconciliation with named offsets.

## 7. Known accepted trade-offs (documented, not silent)

- **Keepsake echo vs cottage shelf coexistence** (review L2): a v6+ save can display the same unique reward item on the cottage keepsake shelf AND see the echo at the giver's place. Decision: the echo celebrates the *giving* (the neighbor kept/made one too — the note says "tucked an extra"), so coexistence is accepted and honest. The v5→v6 migration grants the zine item without pushing `'pip'` into `neighborGiftsReceived`, so legacy saves show no Nook echo — accepted asymmetry, both directions documented here.
- **Noticeboard glint persistence**: true from ~day 2 in most playthroughs (`noticeboardUpdated` = heardBellMystery ∥ bellRestored ∥ orchardGatheringComplete); it reads as gentle "the board carries news" décor rather than an event pulse. The one-day pulse alternative was rejected because it requires new persisted state or event-log archaeology over a pruned buffer (deviation A5).
