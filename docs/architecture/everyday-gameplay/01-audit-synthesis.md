# Everyday Gameplay Systems — Audit Synthesis (GA-A1…A6)

- **Date**: 2026-11-22
- **Method**: six independent read-only specialist audits run in parallel against `main` @ `07be49c` (WorldState v11, 595/595 tests green).
- **Role**: evidence basis for `00-improvement-plan.md`.

## A1 — Activity engine (researcher)

- No generic start/tick/complete loop exists; shared activities = `invitations.active` + `occupancy` + `activeActivity` (2-field pointer) with the transactional, idempotent `completeSharedActivity` as single writer. Refusal chain: `unknown_activity → no_matching_accepted_invitation → host_mismatch → invitation_expired → wrong_location → occupant_not_present → host_unavailable → already_completed`.
- NPC exterior "activities" (utility-scored, seeded per 45-min slot) are a separate concept — no shared abstraction.
- `SharedActivityDef.minutesSpent` (15) is dead data — never consumed. `defaultDurationMinutes` (180) is only the offer window.
- `enterNookAction` alone reconciles invitations + grafts occupancy; other venues do not (asymmetry reserved for LR-3's `reconcileInvitedInteriorEntry`).
- Interior rituals are atomic reducers with day-stamp gating (`*Day === world.day`); interruption surface = expiry/cancellation only. Safe by construction.
- Binding contracts confirmed: derive-only law, single-writer rule, machine reason strings, strict expiry duality, memory-recording APIs, zero-GC tick, seat/stand determinism.

## A2 — Inventory & items

- Central catalog `PERSONAL_ITEMS` = exactly 25 items, 4 categories; per-id `MAX_ITEM_STACK` 20; no total capacity (by cozy design).
- Every `addItemToInventory` call site ignores the returned `added` clamp → phantom "gained" chips at stack cap.
- `lavender_seeds` has a def, a crop def, and UI presence but **no producer** — unreachable crop.
- Pond curios (4 field finds) are gift-only with no second purpose. Two tea aliases (`NOOK_TEA_ITEM_ID` / `COPPERWHEEL_TEA_ITEM_ID`) duplicate `chamomile_pear_tea`.
- Sanitizer + discovered⊇owned invariant + v6 legacy path are sound; registry change is schema-compatible.

## A3 — Cooking & crafting

- Real ingredient crafting exists only at the cottage hearth (`HEARTH_RECIPES`, 5 recipes); bakery/nook/copperwheel are once-per-day neighbor rituals with zero inputs.
- `cookRecipeAction` never sets `flags.brewedChamomileTea` (bell-quest gate lives in dialogue only) — brewing and narrative disagree.
- Output grants ignore stack clamp (silent loss when output at 20).
- Magic-number minute costs in places (almanac +10, sill planter +10, window box +12, planters +15, rest-day +8); constants exist elsewhere.
- No failure states — deliberate cozy design; retained.

## A4 — Gardening & resources

- Greenhouse: 4 crops × 4 pots; binary water-all (+8m); growth = watered-night count; winter freezes; nothing withers. `plantedDay` written but never read.
- `waterStreak`-style care memory does not exist; rain never touches any growing system mechanically.
- Exploration = 4 one-time zone discoveries; repeatable gathering = 4 daily stations + modulo pond pool.
- 2-night crops (chamomile/lavender) mathematically never render the leafy stage model.
- `lavender_seeds` dead (see A2). All four crops share `harvestCount: 2`.

## A5 — Shared activities & community

- Invitation chassis (offer/accept/decline/expire, per-host 2-day spacing, phase-clipped same-day windows) + SF-2 cancellation are mature; registry breadth = 1 (`share_featured_reading`, Nora).
- Completion idempotent on permanent `memoryId` → the single activity is one-shot per save; `shared_tradition` emergent seed (≥2 completed visits) unreachable in legitimate play until a second def exists.
- Community Projects: **designed-only** (GAME_DESIGN §12.2 `PLANNED`; reward = "permanently visible in town"); no WorldState field, no reducer, no owner — the gameplay side is missing entirely.
- Bell precedent (`sideFlags` → environment/renderer consumption) is the sanctioned pattern for persistent visible rewards.
- SF-4 `unmentionedSharedTags` collects NPC-memory tags with prefix `shared_` ≤6 days → a `shared_community` tag rides the +5 echo boost with zero dialogue-engine changes.

## A6 — Governance & QA

- Baseline verified on this tree: 595/595 tests, `tsc --noEmit` clean, layer-boundary script green, `vite build` green (known EL-10 chunk warning only).
- CI gates: lint → test → boundary → build; PR merge-commit only; WORKLOG entry numbers claimed before work (Entry 059 claimed for this initiative).
- Schema bump protocol (doc 07 §2) honored by GA-0: additive types → migrator → sanitizer whitelist → save-revision fingerprint → `CURRENT_SCHEMA_VERSION` bump → owner-table note → full gates.
- Test style: node:test flat `test('ID-xx: …')`, `assert/strict`, staged-world factories from `createFreshWorldState()`.
- Design constraints quoted: "no coins, no shop economy, no daily login streaks, and no failure timers"; "zero starvation meters… zero real-world FOMO traps"; "without turning LITTLE SOMEWHERE into a farming grind, shop-management game, or checklist chore simulator"; community rewards "remain permanently visible in the town"; shared plaza props must not be folded into pocket inventory (the noticeboard stays a public prop — we only read/act through it).
