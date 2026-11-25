# Fishing v1.1 Implementation Record — West Brook Bank (Stage 3 follow-up slice 1)

Branch `stage3/fishing-v11-west-brook`, baseline = origin/main `e7c560a` (verified
2026-11-25). Implements follow-up slice 1 from doc 01 ("Follow-up slices"): the West Brook
second quiet water. The dialogue-topics half of v1.1 (1-2 everyday topics reacting to
catches) is **deferred** — `scripts/dialogue-topics-golden.json` is still owned by the open
`feat/lr3-slice-2` PR (footprint verified via `git diff --name-only origin/main...origin/feat/lr3-slice-2`,
14 files including journal.ts / App.tsx / NeighborhoodCanvas.tsx).

## What shipped

- **Spot registry**: `FISHING_SPOTS` (fishing.ts:56) replaces the single `FISHING_SPOT`
  const; `FISHING_SPOT` remains as a back-compat alias pinned to the v1 jetty def
  (FISH-22 `deepEqual` lock). `performFishingAction(world, spotId)` resolves the spot by
  worldMap prop id; unknown ids fail closed (FISH-27).
- **West Brook Bank** (`west_brook_bank`): new PropInteractableId (types.ts, union end,
  away from the LR-3 `BakeryInteractableId` hunk); new `PROP_INTERACTABLES` row at
  (-4.45, 13.9, r 2.4) — standing point verified by `scripts/probe_brook_spot.ts`:
  walkable + A*-reachable at r 0.48, 0.87u from the culvert water (west tip x -3.58),
  2.44u clear of the hollow-oak circle (1.83u hard ring), ≥ 8.5u from every progression
  token anchor. Mirror row in navigation.test.ts (stand-spot walkable + reachable).
- **Shared once-per-day gate**: `fishingLastDay` stays GLOBAL across both spots (doc 01
  cadence rule) — a cast at the jetty rests the line at the brook and vice versa
  (FISH-23), which also makes spot-hopping reroll farming structurally impossible.
- **Spot-independent RNG**: the catch stream stays keyed on
  `(simSeed, day, 'fishing_v1', catchIndex)` — never on the spot. The day's luck is the
  day's luck; the water decides who answers (FISH-24 pins the golden day table at BOTH
  spots).
- **Pool reuse**: same five species + treasure pool at both waters ("reuses the module
  table"); zero new PersonalItemIds, zero inventory/types/inventory-test churn.
- **Per-spot copy**: `FIRST_CATCH_COPY` becomes per-spot (jetty table byte-identical to
  v1; brook table retells the same discoveries at the culvert). Memory ids stay
  item-keyed — first-of-species is global across the watershed and the first telling is
  preserved verbatim (FISH-25). `castLine`/`quietWaterLine` are spot-aware (FISH-26).
- **Witness memories** carry the spot's `placeName` (Willow Jetty / West Brook Bank).
- **Scene rigs extracted**: `src/scene/fishingRigs.ts` builds both creel-and-rod rigs
  from a placement table (`FISHING_BANK_RIG_PLACEMENTS`) with per-rig offsets;
  environmentRenderer consumes it unchanged in behavior. Jetty rig reproduces the v1
  absolute coordinates byte-for-byte (RIG-02 pin). Brook rig: planks x -6.00..-4.90 at
  z 13.45, creel (-5.10, 14.15), rod (-5.20, 13.72). Two shared materials across both
  rigs (+5 draw calls each, 0 new programs/textures). Rig names follow the
  `propId_rig` convention; placements cross-checked against live worldMap rows (RIG-06).
- **Dialogue assets**: `subjectKeyForPropId('west_brook_bank')` reuses the mirror_pond
  vista (one watershed, one quiet cast) — the only dialogue-file touch, additive case.

## Adversarial QA findings on THIS slice (self-review + browser pass)

| # | Severity | Location | Finding | Resolution |
|---|----------|----------|---------|------------|
| V1-1 | MAJOR (test) | fishing.test.ts FISH-25 (draft) | Asserted a journal row for a TREASURE catch — copy tables cover only the five fish species (v1 behavior), so day-98's glass catch had no row and the check fired on a vacuous branch. | Rewrote the retelling check onto the deterministically-scanned mirror-carp branch (`roll ∈ [0.34, 0.44)` is environment-independent) and added a first-telling-preserved pin. |
| V1-2 | MAJOR (scene) | fishingRigs.ts (draft placement) | Original brook rig offsets (planks x -5.10..-4.00, creel -4.20/14.15, rod -4.30/13.72) tucked the cluster INTO the bridge's visual shadow: occluded by the player sprite from the default NE camera, by the deck rails from the east, and by the deck's SW corner post from the south lawn. Verified across four injected viewpoints (north lawn, bridge deck, south lawn, pond shore). | Shifted the whole cluster ~0.9u west (planks x -6.00..-4.90, creel -5.10/14.15, rod -5.20/13.72) — every mesh west of the rail band, east of the oak canopy, on walkable ground (RIG-03/05 pins). Final pond-shore capture shows the rig unoccluded. |
| V1-3 | MINOR (test) | fishing.test.ts FISH-23 (draft) | Tautological `assert.equal(x, x)` slipped into the refusal branch; would never fail. | Removed; the branch keeps the counter + prose assertions. |
| V1-4 | MINOR (test) | fishing.test.ts FISH-26 (draft) | Prose assertions ran on a scanned day whose composed season/weather could flip the line (winter brook cast line has no "culvert"). | Pinned to day 1 (golden-pinned common branch ⇒ default spring line, deterministic). |
| V1-5 | INFO | fishing.ts | `isDoneToday` is strict equality — a save rolled BACKWARD past the day stamp re-arms the cast. Pre-existing v1 semantic shared with every daily activity; unchanged here, documented as accepted. | none (documented) |

Browser evidence (headless production build, deterministic injected saves, trusted-mouse
tap on the projected proxy): full cast loop at West Brook Bank — prose card "West Brook
Bank" with `+1 Silver Dace` honest grant chip, "Memory saved: A Silver Dart" journal
toast (single visual toast; the double innerText hit is the a11y mirror), spot-flavored
brook line, jetty rig unchanged. Files: `download/asset-qa/stage3-brook/`
(desktop 1440x900 + mobile 390x844). QA script: `scripts/qa_brook_v11.sh`
(single-session deterministic save injection + `__LS_CAMERA_GET__` projection for the
tap pixel).

## Gates (local, recorded)

- Baseline `e7c560a`: `tsc --noEmit` clean; **793/793**; `npm run build` green.
- Branch final: `tsc --noEmit` clean; **807/807** (793 + 8 FISH-21..28 + 6 RIG-01..06);
  `npm run build` green (pre-existing chunk-size warning only).
- WorldState stays **v12** — persistence rides `sideFlags` + `memories` + satchel only;
  `computeWorldSaveRevision` already hashes the two sideFlags keys (v1 slice), so the
  brook needs no new keys.

## Shared-file touches (additive-only, LR-3 slice-2 footprint verified disjoint)

types.ts (+1 PropInteractableId at union end); actions.ts (dispatch branch extended to
accept the second prop id — pure dispatch, no writes); worldMap.ts (+1 registry row);
dialogue/assets.ts (+1 exhaustive-switch case); environmentRenderer.ts (rig builder
extracted to fishingRigs.ts, same behavior); fishing.ts / fishing.test.ts / fishingRigs.ts
/ fishingRigs.test.ts / navigation.test.ts (+rows in existing suites) / scripts/
(probe + QA harness + save generator). Zero edits to App.tsx, NeighborhoodCanvas.tsx,
journal.ts, migrations.ts, invitations*, bakery*, socialProfile.ts, walkability.ts —
none of them appear in this branch's diff.

## Deliberately deferred (doc 01 order + live PR ownership)

1. **Everyday dialogue topics reacting to catches** — golden-topic file owned by open
   `feat/lr3-slice-2`; sequence after it merges (protocol coordination required).
2. Photography frame system — doc 01 sequences it after the LR-3 cluster closes; App.tsx
   + NeighborhoodCanvas.tsx + journal.ts remain locked.
3. Cooking content sliver (2 HEARTH_RECIPES rows) — inventory.ts is unowned; next in
   the dependency order, separate focused PR.
4. Garden window-boxes (schema conversation), collection album (Stage 5) — unchanged.
