# Everyday Gameplay Systems — Improvement Plan of Record

- **Initiative**: Gameplay Advances (GA) — Everyday Gameplay Systems
- **Status**: ADOPTED for implementation (branch `feat/everyday-gameplay-systems`)
- **Date**: 2026-11-22
- **Spec of record**: this document
- **Design constitution**: `GAME_DESIGN.md` §1, §2 (Pillar 5), §11, §12.1–12.2 — no coins, no shop economy, no daily-login streaks, no failure timers, zero FOMO, nothing withers.
- **Audit basis**: six parallel specialist audits (activity engine, inventory/items, cooking/crafting, gardening/resources, shared activities/social, governance/QA), summarized in `01-audit-synthesis.md`.

---

## 1. Guiding Doctrine

Every package in this plan obeys the standing laws of the repository:

1. **Cozy, not grindy.** No currency, no XP bars, no login streaks, no deadlines, no decay. Progress rewards *participation and discovery*, never obligation.
2. **Derive-only presentation.** New player-visible progression signals are *derived* from existing state (SF-1/progression doctrine). We never persist a flag that can be computed.
3. **Single-writer discipline.** The LR-1/LR-2 canonical mutators of `invitations` / `occupancy` / `activeActivity` are untouched. Composition layers compose; they never write those slices directly.
4. **Reservations honored.** LR-3 (Clara/bakery, `share_morning_pastry`, `reconcileInvitedInteriorEntry`, `offer_phase_closed`, `offerPhases`/`arrivalLine`/`summaryCompose`), LR-4 teaching, and LR-5 (Arthur hosting) remain owned elsewhere. This initiative consumes none of those names.
5. **Layer law.** New gameplay lives in `src/game/` (pure TS, node-testable, zero DOM/three/React). UI packages consume via props. World-environmental implementation of community rewards stays with the World team — we only set the `sideFlags` they already know how to read (the Bell precedent).
6. **Machine reasons are API.** New refusal reasons ship with a player-legible label map, never hand-written strings in UI.

## 2. Audit Verdict (compressed)

| System | Verdict | Highest-leverage repair |
|---|---|---|
| Inventory & items (25 items) | Sound core catalog; **producer tables scattered**; stack-clamp overflow silently loses items at cap; `lavender_seeds` unobtainable (dead crop) | Honest grant helper; lavender grant path |
| Cooking (cottage hearth) | Real `RecipeDef` crafting; deterministic; **brewing chamomile tea never sets `flags.brewedChamomileTea`** (quest gate is dialogue-only) | One-line coherence fix |
| Interior rituals (bakery/nook/copperwheel) | Healthy copy-paste family; durations are instant atomic commits (safe by construction) | Leave writers untouched; unify *reads* |
| Greenhouse | Clean growth ladder; **binary water-all, zero care memory, 2-night crops never show the leafy stage**; winter rest is good | Care streaks + rain response |
| Shared activities (LR-1/2 + SF-1..4) | Excellent chassis; one host, one-shot activity; LR-3/4/5 reserved | Do not touch; interconnect via tags |
| Community Projects | **Designed (GAME_DESIGN §12.2), zero implementation, no owner** | Build the gameplay side (contribution, participation, persistent rewards) |
| Progression | `progressionVisuals` derive-only works; no participation-facing summary exists | Everyday practice profile (derive-only) |

## 3. Implementation Packages (independently testable)

### GA-0 — Foundation (schema v12, additive only)
- `WorldState.communityProjects: CommunityProjectsState` (new slice; migrator v11→v12 backfills; sanitizer whitelists; `computeWorldSaveRevision` fingerprints; `stepSimulation` pure-clone list extended).
- `GreenhousePlotState.waterStreak: number` (additive field, backfilled 0, clamped ≥ 0).
- `inventory.applyItemGrants()` — the single honest grant path (honors per-id `MAX_ITEM_STACK` clamp, reports true gains + overflow ids).
- `time.spendMinutes()` / `time.isDoneToday()` — canonical minute spend + day-stamp helpers (named constants replace magic numbers at adoption sites).

### GA-1 — Community Projects (Workstream E) — `src/game/community.ts`
Registry-first, mirroring the `SHARED_ACTIVITIES` pattern:

- `COMMUNITY_PROJECTS` — three starter projects, each **any-of contribution goals** from ordinary everyday items, no deadlines, never expire, open to all tiers:
  1. **Marigold Garland for the Plaza** — flora blooms (posy/chamomile/lavender).
  2. **Orchard Lantern Preparations** — crabapples & honey for the tasting-table lanterns.
  3. **Mirror Pond Mosaic** — field finds pressed into the pond steps (gives the four pond curios a second purpose beyond gifting).
- `contributeToCommunityProject(world, projectId, itemId, amount)` — transactional reducer modeled on `completeSharedActivity`: machine-refusal reasons + label map, inventory consumption via the central API, witness NPC memories (`collectWitnessesForPosition`, tag `shared_community` → SF-4 `unmentionedSharedTags` echo +5 works unchanged), and on goal completion: journal memory, `player_help` world event, gratitude affinity via `applySharedActivityAffinity` (small, cap-exempt, shared-activity discipline), permanent `sideFlags[worldFlag]` (World team consumes for the visible town reward).
- `getCommunityProjectsView` + `describeCommunityNoticeboard` — view models for UI and the plaza noticeboard prose.
- Player-facing surface: the **Neighborhood Noticeboard** (`plaza_noticeboard`) lists live project progress and opens the contribution panel.

### GA-2 — Greenhouse Care Depth (Workstream C) — `src/game/greenhouse.ts`
- **Care streaks (deterministic, grind-free):** each actively-growing plot accumulates `waterStreak` for consecutive watered nights; a harvest with streak ≥ 3 is **lush** (+1 yield, warm prose). Missing a day just waits — "nothing dies" preserved.
- **Rain response:** on `light_rain` days the rain chain carries the water — watering costs no minutes (environment ↔ activity connection; `weather` is already in state).
- **Lavender unblocked:** first tend of the exterior Sunbeam planters also yields a one-time `lavender_seeds` sachet (`foundLavenderSeeds` side flag) — repairs the only dead crop without new items.
- Stage prose clarifies the fast 2-night crops; growth balance untouched.

### GA-3 — Everyday Practice Profile (Workstream D) — `src/game/everyday.ts`
Derive-only "participation & discovery" progression (zero new persisted state):

- `deriveEverydayPracticeProfile(world)` — eight cozy practices (gardening, kitchen, reading, tea & tables, mending, wilds, friendship, community) each with a lifetime count derived from existing counters and tier titles ("Quiet Soil → First Sprouts → Steady Grower → Green Thumb → Keeper of the Beds").
- `touchedToday` — which practices the player touched today (from `dailyActivities` + day-stamps), for the "worth returning to tomorrow" feel.
- `keeperTitle` — one gentle overall title derived from total practice engagement.
- Journal card surfaces it; `progressionVisuals` scene mementos remain untouched.

### GA-4 — Honesty & Coherence Repairs (Workstream A)
- All item-grant call sites adopted onto `applyItemGrants` — no more phantom "gained" chips when the satchel is at stack cap.
- `cookRecipeAction('recipe_chamomile_tea')` now sets `flags.brewedChamomileTea` (brewing and dialogue finally agree).
- Magic minute costs at cottage/exterior adoption sites converted to `spendMinutes` with a gentle "the evening slipped away" signal.

### GA-5 — UI Packages
- `CommunityProjectsPanel.tsx` — noticeboard-driven projects sheet (progress, item chips, contribute buttons, completed banners), storybook palette, ≥44px touch targets.
- `GreenhousePanel.tsx` — care-streak chips and rain-day line.
- `App.tsx` wiring for the panel + contribution handler; journal practice & community cards.

### GA-6 — QA (independent)
- New suites: `community.test.ts` (CP-xx), `greenhouse.test.ts` additions (GD-xx), `everyday.test.ts` (EP-xx), grant/streak unit pins (IG-xx/GH-xx).
- Full gates (`npm test`, `tsc --noEmit`, layer boundary, `vite build`) + adversarial review (save-integrity, sanitizer round-trip, idempotency, non-interference with LR chassis) + live browser verification at 1440×900 and 390×844 with zero console errors.

## 4. Explicitly Out of Scope (this initiative)

- LR-3/LR-4/LR-5 shared-activity hosts, teaching, or any new `SharedActivityDef` entries.
- Player→NPC invitations; widening `occupancy` to participant sets.
- New `PersonalItemId`s, recipes, crops, or shops; any currency.
- Scene/environmental rendering of community rewards (World team consumes `sideFlags[worldFlag]`).
- `PendingActivity` interruptible-craft state machine (durations remain honest atomic spends; revisited only if a future design demands multi-tick crafts).

## 5. Interconnection Map (why this makes everyday play cohere)

```
 seasons/weather ──► rain-day watering (GA-2)            environment ⇄ activity
 inventory items ──► community contributions (GA-1)      satchel ⇄ community life
 pond field-finds ─► pond mosaic (GA-1)                  discovery ⇄ purpose
 care streaks ────► lush harvests (GA-2)                 attention ⇄ reward (no grind)
 contributions ───► witness NPC memories (tag shared_community)
                   ► SF-4 dialogue echo boost (+5)        deeds ⇄ conversation
 completions ─────► sideFlags[worldFlag] (Bell precedent) gameplay ⇄ World-team visuals
 every counter ───► practice profile (GA-3, derive-only)  participation ⇄ identity
```

## 6. Acceptance Invariants

1. A v11 save loads clean under v12 with zero data loss (waterStreak backfilled 0, community shelf empty); byte-deterministic replay preserved.
2. `contributeToCommunityProject` is idempotent at completion; refuse-reasons are machine strings; zero inventory mutation on any refusal.
3. Watering a plot one day less than three nights never yields lush; winter resets streaks; rain-day watering costs zero minutes and still waters.
4. Every item grant path reports the true `added` count; no chip overstates the satchel.
5. The practice profile derives identical output from identical state and persists nothing.
6. All existing 595 tests stay green; layer-boundary script stays green; LR chassis untouched (no diffs in `invitations.ts`/`activities.ts` writers).
