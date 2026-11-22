# Everyday Gameplay Systems — Adversarial QA Record

- **Date**: 2026-11-22
- **Method**: independent QA round — four formal gates, thirteen adversarial probe scripts (throwaway, `/tmp`), live browser verification at two viewports.

## 1. Formal gates (all green)

| Gate | Command | Result |
|---|---|---|
| Unit tests | `npm test` | **625/625 pass, 0 fail** (595 inherited unmodified + 30 new), 36 s |
| Typecheck | `npx tsc --noEmit` | **0 errors** |
| Layer boundary | `npx tsx scripts/check_layer_boundaries.ts` | **green** — 63 game / 61 scene / 12 component files; only the known sanctioned warning W5 (`journal.ts` localStorage, unchanged) |
| Production build | `npm run build` | **green**, 1.45 s; known EL-10 chunk-size warning unchanged |

## 2. Adversarial probes — 13/13 PASS

| Probe | Verdict | Evidence |
|---|---|---|
| P1a v11 save integrity | PASS | v11 payload (no `communityProjects`, plots without streaks) migrates to v12: streaks backfilled 0, shelves present, inventory/day/minute byte-preserved |
| P1b deterministic replay | PASS | `serialize→deserialize→serialize` byte-identical |
| P2 garbage resistance | PASS | string/array payloads reset silently; unknown project ids dropped with warnings; non-accepted item ids dropped; fractional counts floored; over-counts clamped to `MAX_CONTRIBUTED_PER_ITEM` (40); negative `completedDay` floored — never throws |
| P3 save-revision sensitivity | PASS | fingerprint changes on contribution and on streak change; identical states → identical fingerprint |
| P4 LR chassis non-interference | PASS | contribution with a staged live invitation + occupancy + activeActivity leaves all three slices deep-equal; `git diff --name-only` shows `invitations.ts` / `activities.ts` untouched |
| P5 completion idempotency | PASS | full garland completion: single journal memory; second attempt refused `project_completed` with world reference identical |
| P6 clamps + honest overflow | PASS | 9 chamomile offered with 3 remaining → 3 recorded, only 3 consumed; grants at `MAX_ITEM_STACK` → `gainedItems` empty, `overflowIds` populated, satchel untouched |
| P7 simulation clone isolation | PASS | mutating `stepSimulation` clone's shelves never touches the original (and the LR-tick suite stays green) |
| P8 rain-day watering | PASS | `light_rain` → 0 minutes spent, pots watered; `sunlit` → +8 minutes |
| P8b lush math | PASS | streak 3 → yield 3 (2+1), streak resets to 0 post-harvest; streak 2 → yield 2 |
| P9 day-roll preservation | PASS | shelves survive `advanceToNextDay`; `touchedToday` empty on the fresh day |
| P10 profile determinism | PASS | identical worlds → deep-equal profiles; undefined/null slices degrade to zeros ('A Quiet Start'), never throw |
| P10b view well-formedness | PASS | three views, 8+6+6 = 20 authored goals, all items resolved |

## 3. Live browser QA (formal sign-off)

- **Desktop 1440×900** (`?autostart=1`): game boots clean; **0 console errors, 0 page errors**.
  - Journal → Discoveries: 'Daily Practices' card (keeper title, 8 practice lines with counts + tier titles, touched-today footer) and 'Community Shelves' card (headline + 3 project lines) render correctly.
  - Teleport-via-save to the plaza noticeboard → interact [E] → prop card shows community shelf lines + **'Check the Community Shelf'** action button.
  - Panel opens: correct disabled states (only the starter chamomile enabled), summary strip '0 of 20 strands gathered across town'.
  - **Golden path**: contribute 1 chamomile → progress bar 0→1/3, summary '1 of 20 strands', toast 'Tucked Chamomile Blossoms into the Village Plaza basket — the shelf shows 1/3 now.', satchel decremented, button honestly disabled afterwards.
  - **Persistence**: localStorage save carries `communityProjects`; page reload → journal shows contribution (practice 'Community Shelves' count 1, keeper title advanced to 'A Neighbor of Little Somewhere', garland 1/8).
- **Mobile 390×844**: zero horizontal overflow (`scrollWidth === 390`) in game and panel; panel fully usable; contribute buttons reachable.
- Screenshots committed under `download/asset-qa/everyday-gameplay/` (desktop-title, desktop-contribute, mobile-game, mobile-panel).

## 4. Findings

- **F1 (fixed during implementation)**: greenhouse-planters chip expectation in `cottage.test.ts` updated for the GA-2 seed sachet — test now documents the new honest chip set.
- **F2 (probe-harness, not product)**: two probe scripts initially imported from the wrong modules; fixed in the probes only. No product defect.
- **No open findings.** Verdict: **SHIP**.

## 5. Reservations honored (mechanically verified)

- LR-3 reservation map (`share_morning_pastry`, `reconcileInvitedInteriorEntry`, `offer_phase_closed`, `offerPhases`/`arrivalLine`/`summaryCompose`, `dialogue/invitations/clara.ts`) — absent from the diff.
- `invitations.ts` / `activities.ts` / `occupancy.ts` — untouched (git diff).
- Dialogue registry + golden snapshot — untouched (no topics added; `shared_community` echo rides the existing SF-4 seam).
