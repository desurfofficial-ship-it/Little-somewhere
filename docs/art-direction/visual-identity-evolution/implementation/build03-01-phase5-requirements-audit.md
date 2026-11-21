# BUILD 03 — Phase 5 Requirements Audit (Requirements-to-Implementation Matrix)

**Build**: BUILD 03 "PROGRESSION MADE VISIBLE" · **Scope source**: Doc 08 `08-visual-upgrade-implementation-roadmap.md` Phase 5 (rows 5.1–5.5 + risk notes), specified in Doc 07 `07-visual-progression-specification.md`.
**Baseline tree**: `origin/main` @ `ed860e0` (branch `feat/visual-identity-evolution-build-03`). Baseline checks executed on this exact tree, not inherited: **`npm test` 447/447 · `npx tsc --noEmit` 0 errors · `npm run build` exit 0** (pre-existing >500 kB chunk warning only).

---

## 1. What Phase 5 actually requires (exact source text)

Doc 08 Phase 5 table (verbatim):

| Item | Detail | Pri |
| :--- | :--- | :--- |
| 5.1 Storyline world props | 5 props per Doc 07 §5.1 | P2 |
| 5.2 Relationship-tier tokens + keepsake echo | Doc 07 §5.2 | P2 |
| 5.3 Within-season drift | canopy tint lerp + meadow crossfade + sill posies (Doc 07 §5.3) | P2 |
| 5.4 Exploration marks | Doc 07 §5.4 | P3 |
| 5.5 Memento tiers + housekeeping signals | Doc 07 §5.5–5.6 | P3 |

Doc 08 Phase 5 risk notes: *fresh-save parity regression (explicit test Doc 07 §7.3); clutter (placement law + restraint review); `cozyLateNightHint` verify-first.* Dependencies: *Phase 0 veteran save; none else (pure scene-side derivation).*

Doc 07 binding rules (§4, §7): derive-only (no save fields, no migrations, no reducers); revision-gated rendering; permanent/gentle/non-cluttering; in-game time only; celebration over checklist; every extension adds derive/toggle tests; **fresh-save parity is an explicit test**; full-progress capture via a veteran save; seasonal clearance law (0.4–0.45 u from interactables); district draw budgets.

## 2. Implementation status before BUILD 03 (verified by code inspection on the baseline tree)

| Roadmap item | Status before BUILD 03 | Evidence |
| :--- | :--- | :--- |
| P1 story-flag prop groups (existing baseline) | **Implemented** (13 flags → world props) | `narrative.ts:42–70` → `environmentRenderer.ts:205–286` |
| P2 outcome-branched dioramas | **Implemented** (orchard gathering) | `environmentRenderer.ts:319–324` → `orchard.ts:823–828` |
| P3 derived home mementos (binary `>0`) | **Implemented** (5 mementos) | `cottageInterior.ts:1819–1825` |
| P4 deterministic day-cycle swaps | **Implemented** (bake/book/project/crop cycles) | `bakery.ts`, `bookNook.ts`, `copperwheel.ts`, `greenhouse.ts` + interior rigs |
| 5.1 storyline world props (5) | **Absent** — 4 storylines scene-silent; lanterns conflict expressed only via festoon strand | grep `src/scene` for `pipZine|herbLoaf|pondStand|watchTune|lanternConflictOutcome` → 0 consumers |
| 5.2 relationship-tier tokens + keepsake echo | **Absent** — affinity drives greeting distance + journal only; `neighborGiftsReceived` never read by the scene | `simulation.ts:836–845`; grep → 0 scene consumers |
| 5.3 within-season drift | **Absent** — season dressing is binary per season; `dayOfSeason` computed (`environment.ts:259`) but no renderer consumer | grep `dayOfSeason` in `src/scene` → 0 |
| 5.4 exploration marks | **Absent** — `explored_*` sideFlags → journal + memories only; discovered landmarks look identical | grep `explored_` in `src/scene` → 0 |
| 5.5 tiered mementos | **Absent** — counters used only as `> 0` booleans | `cottageInterior.ts:1819–1825` |
| 5.6a noticeboard update signal | **Dead signal** — `playerChanges.noticeboardUpdated` computed + revision-packed, no renderer consumer | `narrative.ts:66–67`, `environment.ts:201`, grep → 0 |
| 5.6b `cozyLateNightHint` | **Composer-only** — computed (`environment.ts:139`), no renderer consumer; *verify-first risk applies* | grep → 0 |

Also verified present and preserved: BUILD 01 (PR #4 `1f7ffa5`, report + WORKLOG), BUILD 02 (PR #6 `78d7d00`, report + WORKLOG Entry 053), the Build-10/LR recovery merge (PR #5) and the post-BUILD-02 concurrent fixes `ed860e0`/`7f28d75` (Copperwheel window-armchair clip fix) and `fd8d0e2`/`5a250f9` (agent-skills docs). None of these are reworked; the armchair fix is carried as-is.

## 3. Changed / corrected assumptions discovered during the audit

These adjust Doc 07's *proposals* where the actual repository differs. Each deviation is binding only where Doc 07's own hard rules (§7.1 derive-only) force it; everything else follows the document.

| # | Doc 07 assumption | Actual repository finding | Resolution |
| :--- | :--- | :--- | :--- |
| A1 | Revision mask has room for new signals | `environment.ts:193–238` — `staticFlagsMask` bits 0–16 are all occupied; weather/season/orchard/day occupy bits 17–32 | New signals ride a **separate derived integer** (`ProgressionVisualState.revision`) carried as an **additive field** on `ComposedEnvironmentState`; the renderer gates on both integers. No bit repacking, no risk to the existing dirty-flag contract |
| A2 | §5.5 "book stack gains a 2nd book at booksRead ≥ 4, a 3rd at ≥ 9" | `nookState.booksRead` caps at 4 per cycle (`bookNook.ts` — "max 4 cycle"); ≥ 9 is unreachable → a dead tier | Tiers re-based to **reachable** thresholds (≥ 2 / ≥ 4), documented here; the derive-only growth-stage rule is what is binding, the example numbers were illustrative |
| A3 | §5.5 "honey crock dipper after 3 orchard harvests" | No cumulative orchard-harvest counter exists (`dailyActivities.orchardHarvestedToday` is day-scoped; memory ids are one-time) | Dipper derives from the authoritative cumulative counter that does exist: `greenhouseState.totalHarvests ≥ 3` (the honey crock's already-shown memento already keys on orchard/greenhouse progress) |
| A4 | §5.2 keepsake echo "rests on the resident's shelf/counter **the next day**" | `neighborGiftsReceived: ResidentId[]` carries no day stamp; no other persisted source stamps when the reward was granted | Echo derives from `neighborGiftsReceived` alone and appears when earned (same session, next scene sync). The "next day" refinement is impossible without a new save field — forbidden by §7.1. Honest and still derived |
| A5 | §5.6 "brass pin brightens **on update day**" (one-day pulse) | `noticeboardUpdated` is a persistent boolean; the day it flipped is not derivable from any persisted state without new state | The newest flyer's brass pin carries a **persistent subtle glint while the board has news** (`noticeboardUpdated === true`). One-day pulse rejected: it would require either new state or event-log archaeology over a pruned 40-entry buffer — both violate §7.1 |
| A6 | §5.2 "Friend (≥3 hearts)" | `getHeartLevel(affinity) = floor(affinity/20)` → 3 hearts = **affinity ≥ 60**; Kindred tier = affinity ≥ 90 (`relationships.ts:38–45`) | Token gates: friend charm at affinity ≥ 60, kindred marigold ribbon at ≥ 90 (exact thresholds pinned in tests) |
| A7 | `porchSeasonLife.ts:16–17` claims Copperwheel porch "NOT wired" | Canvas wires it (`NeighborhoodCanvas.tsx:974–975`, `:1857`) | Code wins; stale docstring corrected in passing (BUILD 02 leftover, explicitly noted) |
| A8 | BUILD 02 report §14.3 claims `VISUAL_QUALITY_STANDARDS.md` "now carries the evidence-backed rule" | The reconciliation edit landed only in `VISUAL_IDENTITY.md` §10; `VISUAL_QUALITY_STANDARDS.md` still lacks it. Report also cites "WORKLOG Entry 051" for BUILD 02 — that entry was renumbered **053** at the PR-#5 merge | Closed **explicitly** during BUILD 03 Stage 7 (the missing edit + stale pointer fixed, recorded in the implementation report). Not silent — this audit is the disclosure |

## 4. Scope decisions

**In scope** (all of Doc 08 Phase 5): 5.1 (five storyline props), 5.2 (tier tokens + keepsake echo), 5.3 (within-season drift), 5.4 (exploration marks), 5.5 (tiered mementos), 5.6 (both housekeeping signals). Plus the BUILD 03 brief's mandatory non-visual deliverables: requirements audit, progression-to-visual specification, environmental memory layering, location-identity audit, technical architecture record, evidence, performance, testing, report, WORKLOG.

**Out of scope** (explicit rejections, per the brief's authorization limits):
- Doc 08 Phase 6 (animation depth) and Phase 7 (UI iconography) — different phases; noted as next candidates.
- Any `src/game/` **behavioral** change: no reducers, no tick logic, no progression pacing, no schema/migration, no new persisted fields. The only game-layer additions are **pure additive derivation functions** (like the existing `environment.ts` composer), which by construction cannot alter simulation behavior.
- No new residents, buildings, world layout changes, currencies, timers, or completion percentages.
- Workstream F (interaction feedback) findings are recorded but deferred to Phase 7 — the world-side feedback IS this build's 5.1–5.6 props.

## 5. Requirement-to-implementation matrix

Legend — **Owner**: authoritative state owner (existing, untouched). **Trigger**: existing event that changes it. **Persistence**: derived → survives save/load automatically (recomputed), never serialized. **Timing**: driven by in-game clock/state only. **Reversal**: visual regresses exactly when the underlying state does.

| Feature | Owner (authoritative) | Trigger | Visual response | Persistence | Timing | Reversal | Perf plan | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 5.1a Zine chalk cover + caddy (Noticeboard) | `sideFlags.pipZinePrinted`, `pipZineTheme` ∈ {art_edition, kitchen_edition, classic_edition} | `side_pip_zine` completes (`syncSideFlagsFromStorylineInPlace`) | Chalk-drawn zine cover pinned to the board's side rail; chalk caddy at its foot; cover chalk-tint shifts with the edition | Derived | Storyline completion day (state edge) | Flag cleared → hidden | ≤4 merged meshes, 1–2 materials | Veteran capture ×3 editions; fresh-save hidden; walkability test |
| 5.1b Herb-strung window crate (Bakery ledge) | `sideFlags.herbLoafShared`, `herbLoafStyle` ∈ {plaza_table, tea_basket} | `side_herb_loaf` completes | Herb-strung crate on the bakery display ledge; style shifts the hanging bunches (plaza = marigold-heavy, tea = chamomile-heavy) | Derived | Completion day | Flag cleared → hidden | ≤5 merged meshes | Veteran capture ×2 styles; clearance vs ledge interactables tested |
| 5.1c Cedar music stand (Mirror Pond south bank, by Sora's bench `seat_pond_south` @ 1.8, 19.3) | `sideFlags.pondStandBuilt`, `pondStandStyle` ∈ {carved_clef, weatherproof_oak} | `side_pond_stand` completes | Notched cedar music stand with sheet; clef inlay (carved_clef) or oak brace + wind clip (weatherproof_oak) | Derived | Completion day | Flag cleared → hidden | ≤4 meshes | Capture ×2; clear of bench seatTopY volumes + nav edges (tests) |
| 5.1d Brass pendulum charm (Copperwheel porch lantern) | `sideFlags.watchTuneFinished`, `watchTuneStyle` ∈ {steady_route, patient_repair} | `side_jun_watch` completes | Tiny brass pendulum charm under the porch lantern; style shifts the charm's lower weight (route tag vs teacup bead) | Derived | Completion day | Flag cleared → hidden | ≤3 meshes | Capture; porch dressing zone clearance test |
| 5.1e Pier sconces ×2 (Mirror Pond pier) | `sideFlags.lanternConflictResolved`, `lanternConflictOutcome` ∈ {bridge_compromise, gentle_space, public_harmony} | `conflict_plaza_lanterns` completes | Two hooded lantern sconces on the pier posts; hood shape/tint per outcome (amber compromise = warm downward hood; sanctuary = unlit pier + bridgehead pair at the cedar bridge; candle walk = softer duo glow) | Derived | Completion day | Flag cleared → hidden | 1 instanced or ≤6 meshes; emissive rides existing lantern program | Capture ×3 outcomes at dusk; pier geometry zone `vegetation.ts` honored |
| 5.2a Friend charms (affinity ≥ 60) | `playerRelations[id].affinity ≥ 60` (heart ≥ 3) | Gift/talk accumulation (`relationships.ts`) | Tiny crafted charm on the resident's own place (per-resident anchor table: bakery sill for Clara, greenhouse frame for Mina, woodshop doorframe for Barnaby, nook post for Nora, workshop post for Arthur, orchard ladder for Rowan, plaza cart-side for Sora, pond rail for Toby, post-lane mailbox for Jun, bakery upstairs sill for Pip) | Derived | Affinity edge | Affinity < 60 → hidden | ≤2 merged meshes each, hidden groups cost 0 | Capture (Clara + Mina + Barnaby); threshold test; clearance law |
| 5.2b Kindred marigold ribbon (affinity ≥ 90) | `playerRelations[id].affinity ≥ 90` | Affinity edge | Hand-tied marigold ribbon knot on the resident's porch post (visual rhyme with festival ribbon `landmarks.ts:235–256`) | Derived | Affinity edge | Affinity < 90 → hidden | ≤3 meshes each | Capture ×1–2 residents; threshold test |
| 5.2c Keepsake echoes | `neighborGiftsReceived` ∩ `NEIGHBOR_KEEPSAKE_REWARDS` (`inventory.ts:397–428`) | Neighbor gift action (`actions.ts:3875`) | The reward item rests on the giver's own counter/shelf: zine copy on Nook counter, watercolor card on Toby's pond rail spot, brass bell on Arthur's bench, herb wreath on Mina's greenhouse shelf, cedar dish on Barnaby's bench | Derived (A4) | Grant edge | Removed → hidden | ≤2 meshes each | Capture (Nook counter + workshop bench); identity test vs `displayedKeepsakeIds` cottage shelf |
| 5.3a Canopy tint drift | `getSeasonForDay(day).dayOfSeason` (1–10) | Day advance | Grove `crownBaseMat`/`crownTopMat` lerp bud→full (spring/summer) / full→turn (autumn) across the season; winter stays its hushed state | Derived | In-game day | Continuous by day | 2 material `.color` writes per day-change (revision-gated) | Lighting-suite style hex tests ×3 day stages |
| 5.3b Meadow crossfade | `dayOfSeason` | Day advance | Meadow clover/grass instance tint drifts early→peak→late within season (re-tints the existing instanced layers; zero new geometry, zero new draw calls) | Derived | In-game day | Continuous by day | Instance color write on day edge only | Test: same world+day → identical snapshot; drift bounds |
| 5.3c Cottage sill posies | `dayOfSeason` thresholds 3/7 (non-winter) | Day advance | Sill-posy bottle gains stems at day 3, full at day 7; winter resets to bare | Derived | In-game day | Continuous by day | ≤2 visibility toggles | Threshold test ×3 days |
| 5.4a Well ribbon (Sorrel Hollow, well @ −20.4, 18.3) | `sideFlags.explored_sorrel_hollow` | Wilds discovery (`exploration.ts:107–130`) | Hand-tied survey ribbon on the Old Stone Well coping | Derived | Discovery edge | Discovery is permanent; flag removed → hidden | ≤2 meshes | Capture; walkability |
| 5.4b Rise cairn (Foxglove Rise @ 21.6, 18.5) | `sideFlags.explored_foxglove_rise` | Discovery | Small cairn stone added beside the lookout deck | Derived | Discovery edge | As above | ≤3 merged meshes | Capture; deck clearance |
| 5.4c Lane chalk arrow (Marigold Lane @ 20.3, 5.5) | `sideFlags.explored_marigold_lane` | Discovery | Chalk arrow on the lane signpost | Derived | Discovery edge | As above | ≤2 meshes | Capture |
| 5.4d Hive wreath (Bee Line @ 10.4, −18.8) | `sideFlags.explored_bee_line` | Discovery | Sprig wreath on the wild bee log | Derived | Discovery edge | As above | ≤2 meshes | Capture |
| 5.5 Memento tiers (cottage) | `nookState.booksRead` (≥2/≥4), `greenhouseState.totalHarvests` (≥3), `bakeryState.kneadingSessions` (≥5) | Ritual counters | Book stack +1/+2 books; honey crock gains dipper; recipe card gains a second card | Derived (A2/A3) | Counter edge | Counter can only grow; derivation handles any value | ≤4 small meshes, interior batch root | Interior capture; threshold tests |
| 5.6a Noticeboard glint | `playerChanges.noticeboardUpdated` | Bell-mystery/bell-restored/orchard-completion flags | Newest flyer's brass pin gains a subtle emissive glint while the board has news (A5) | Derived | Flag edge | Flag semantics unchanged | 1 cloned pin material | Renderer test + capture |
| 5.6b Late warm windows | `cozyLateNightHint` (minute ≥ 1260) | In-game clock ≥ 21:00 | Window-glass warm step (+0.2 emissive intensity) on evening-lit windows; verify-first per Doc 08 | Derived | Minute edge (curve, not revision) | Continuous with clock | Curve arithmetic only | Verify capture 20:45 vs 21:15; curve test |

## 6. Baseline verification record

- Remote state: `origin/main` @ `ed860e0`; branch cut `feat/visual-identity-evolution-build-03`; no force-push, no history rewrite; PR #5/#6 merged work preserved.
- Tests re-run on the baseline tree: **447/447** (verified, not inherited). `tsc` clean. `vite build` clean (pre-existing chunk-size warning).
- Baseline perf capture on this tree: recorded in `download/asset-qa/build03-validation/baseline-perf.json` (see implementation report §Performance; methodology identical to BUILD 02: veteran golden-hour world, 20 s sampling, `__LS_PERF__`).
- No uncommitted work in the game repo at branch cut (clean tree).
