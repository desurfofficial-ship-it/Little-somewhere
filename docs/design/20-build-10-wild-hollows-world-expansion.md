# Build 10 — The Wild Hollows: World Expansion Design & Implementation Plan

**Date**: 2026-11-21 · **Status**: IMPLEMENTED & verified (Build 10, WORKLOG Entry 048 — passes A–D complete; QA evidence in `download/asset-qa/wilds/` + `scripts/qa_wilds.sh`)
**Mission**: Turn the empty meadow ring of `willow_square` into an explorable wild geography with real destinations, discoveries and interconnections — *architectural richness of the landscape, not map bloat*.

---

## 1. World Experience Assessment (Phase 1 findings)

**What exists**: 50 × 46 u region; 10 landmark zones, 16 interactables, 5 benches, 33-node A*; 5 enterable interiors; orchard district; pond/bridge/brook/pier; 10 residents with schedules + extra activities; 6 storylines, 79 dialogue topics; journal Discoveries rows (hand-maintained); open `sideFlags` registry (save-safe without migration); dialogue conditions already support `sideFlagsTrue/False`; `getGroundHeightAt` is the single proven elevation channel (bridge) used by player, residents, props, camera.

**Geography gaps** (walkable but content-empty):
1. East strip `x 18..25` (7 × 46 u) — nothing.
2. SE corner `x 17..25, z 17..23` — nothing.
3. South strip `z 17..23, x -25..-8` — pond bench lawn only.
4. NE meadow `x 6..25, z -16..-23` — nothing east of orchard.
5. SW meadow `x -25..-8, z 14..23` west of pond — nothing.

**Experience gaps**: every landmark is visible from the plaza (nothing to *find*); map edges have zero destinations; the Journal rewards quest/building states only; residents rarely leave the built core. The world bounds are large but the content occupies roughly `x -19..17, z -20..19`.

## 2. Design — "The Wild Hollows"

A ring of four named wild destinations connected by visible trails, forming an exploration loop around the district:

| Destination | Location | Identity | Functional layer |
| --- | --- | --- | --- |
| **Marigold Lane** | E strip trail `x≈20.3`, z 1.5→14 | Petal-bright wildflower lane behind the greenhouse | `marigold_bank` pick (daily-gated `meadow_posy`); Mina evening walk |
| **Foxglove Rise** | SE knoll `(21.4, 19.0)` | Terraced lookout knoll, cedar deck (h 0.62) + ramp, view bench | `rise_vista` season/weather-aware panorama; 6th/7th outdoor seat; deck via proven `getGroundHeightAt` bridge pattern |
| **Sorrel Hollow** | SW clearing `(-20.6, 18.2)` | Birch-shaded forgotten garden with the mossy **Old Stone Well** | `old_stone_well` lore + one-time `foxglove_seeds` find + pebble-echo counter; bench; Pip's adventure spot |
| **The Bee Line** | NE spur `(10.5, -19.4)` | Orchard-east wild-bee log trail toward Copperwheel | Rowan's wild-hive check; connects orchard ↔ copperwheel east |

**Interconnection chain** (living-world loop): wander Marigold Lane → find Foxglove Rise → well lore at Sorrel Hollow → `foxglove_seeds` → 4th greenhouse crop **Foxglove** (Mina's growing corner) → bloom gift/vase + Mina dialogue topic (gated `sideFlagsTrue`) → journal rows transform. Discovery itself (HUD zone label + Journal row + memory) requires no quest marker.

## 3. Systems contracts (all additive; zero migration)

- `sideFlags` for all discovery/counter state (`explored_*`, `wellPeered`, `wellPebblesCount`, `posyPickedDay`) — `sanitizeSideFlags` preserves arbitrary keys.
- `PropInteractableId` + `PersonalItemId` + `GreenhouseCropId` union appends only.
- `LANDMARK_ZONES` + 4 new `SEAT_SPOTS`? → 2 new seats (rise, hollow) + circles.
- `CIRCLE_OBSTACLES`: well, bee log, 3 birches, 2 hollow trees, 2 lane boulders. `BOX_OBSTACLES`: 5 mound-body boxes framing ramp+deck (bridge-pattern guard rails).
- `NAV_NODES` +12 / edges +16; all targets & approach spots walkable-validated by tests.
- Residents: 3 new extra activities (Mina/Pip/Rowan) with walkable targets.
- Scene: new `src/scene/builders/wilds.ts` (shared palette materials, instanced/merged, contact shadows, grove-shared season-tint crown materials); canvas wiring; deck height in `getGroundHeightAt`.
- Draw budget target: ≤ ~40 new meshes; mobile re-measured; zero per-frame allocation.

## 4. Passes (each gated: npm test · tsc · lint · build)

- **Pass A — Game layer**: `exploration.ts` registry + sim discovery hook; worldMap zones/obstacles/interactables; nav graph; types/greenhouse crop/inventory items; journal rows; tests.
- **Pass B — Interactions & life**: actions cases (well/vista/bank); resident activities; Mina dialogue topic + golden snapshot re-baseline.
- **Pass C — Scene**: `wilds.ts` builders + canvas + height function; scene placement tests.
- **Pass D — QA & docs**: probes, headless desktop+mobile visual evidence, WORKLOG/HANDOVER/GAME_DESIGN/ARCHITECTURE, push main.

**Explicit non-goals**: no new buildings/interiors, no collision footprint changes to existing structures, no Copperwheel (Arthur) content, no dialogueEngine/migrations changes, no new dependencies.
