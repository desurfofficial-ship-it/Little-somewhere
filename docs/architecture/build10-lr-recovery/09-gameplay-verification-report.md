# 09 — Gameplay Verification Report (Browser QA)

**Environment:** Chromium (agent-browser 0.43.0, headless, software-GL throttled pacing), Vite production build served by `vite preview`, seeded saves injected into `localStorage` (`little_somewhere_world_v1`) on the title screen and loaded through the real application via `?autostart=1` — the project's established QA pattern. Viewport 1440×900 (+390×844 mobile spot-check). Readbacks read the **real autosaved state** from `localStorage`, not in-memory fixtures.

**Reproducible staging:** `scripts/make_integration_qa_saves.ts` (committed) generates all payloads; runner scripts preserved in the operation log. Console and page errors were cleared before each run and audited after: **0 console errors, 0 page errors across every scenario.**

| Scenario | Result | Evidence (screenshot + state readback) |
|---|---|---|
| **G1 — Exploration discovery through the live tick** | **PASS** | Save parked on walkable ground inside Marigold Lane (20.3, 5.5) → within one tick the autosave contains `explored_marigold_lane: true` + `mem_explored_marigold_lane` (readback `{marigold:true, mem:true, minute:540, pos:[20.3,5.5]}`). Real page reload → both persist. Journal → Discoveries shows the "Marigold Lane" landmark row. `qa-screenshots/g1-discovery-zone.png`, `g1-journal-discoveries.png`. |
| **G2 — Wild Hollows check-in through the UI** | **PASS** | Save with `explored_sorrel_hollow` + every competing Mina topic spent same-day → Talk → the check-in surfaces on the FIRST dialogue open: the rendered text is the topic's fresh-state branch *"So you've wandered down to the old well in **Sorrel Hollow**? I've always wondered who planted the garden that once kept it…"* (`wilds.ts` default branch — the check-in prose names the Hollow; the topic id is `daily_mina_foxglove`). `qa-screenshots/g2-mina-foxglove-checkin.png`. |
| **G3 — Nora offer + acceptance through ordinary dialogue** | **PASS** | Talk → offer topic surfaces → real choice **"I'd love that—I'll meet you inside."** clicked → autosave shows `invitations.active = {status:'accepted', activityId:'share_featured_reading', window:[540,719]}`. `qa-screenshots/g3-nora-offer-topic.png`, `g3-nora-accepted.png`. |
| **G4 — Nook entry through the real door [E] + occupancy triple** | **PASS** | Production-created accepted invite (offer/accept reducers in the staged save), player parked facing the door → **"Step Inside [E]"** prompt → [E] → toast **"Stepped inside Linden Book Nook — Nora looks up from the reading chair."** → autosave: `{occupancy:{residentId:'nora', stationId:'nook_chair', invitationId:'inv_nora_share_featured_reading_d2_m540'}, playerLocation:'nook_interior', activeActivity:'share_featured_reading'}` — the complete occupancy triple, host visibly seated in the interior scene. `qa-screenshots/g4-nook-entry-nora-seated.png`. |
| **G5 — Schedule-drift backstop (Decision A) through the real door** | **PASS** | Same accepted invite, clock advanced to 700 (afternoon: Nora's static slot is West Bench, beyond the home radius) → "Step Inside [E]" → the door still opens, the invite is archived `expired` with `reason:'host_unavailable'`, no occupant is created, refusal line shown ("…Nora had to step out — your invitation window closed."). A **dynamic** variant was also observed live: with the host encounter-pulled before entry, the same visible refusal fired (first G4 attempt — correct Decision A behavior, not a defect). `qa-screenshots/g5-drift-refusal.png`. |
| **G6 — Mid-activity reload (real save/load path)** | **PASS** | During the active visit (occupancy + activity set): real `location.reload()` → restored `{occupancy:'nora', playerLocation:'nook_interior', activeActivity:'share_featured_reading', inviteStatus:'accepted'}` — occupant, station link, activity, and invite all survive the production autosave/load path. `qa-screenshots/g6-midvisit-reload.png`. |
| **G7 — General gameplay regression** | **PASS** | Keyboard movement displaces the player; `+2h` advances the clock (540 → 661); interior/exterior transitions and dialogue close clean; **0 console errors / 0 page errors** across all scenarios; mobile 390×844 shows `scrollWidth === innerWidth` (no overflow). `qa-screenshots/g7-general-gameplay.png`, `mobile-390x844.png`. |

## H-7 disposition — Sorrel Hollow zone-center walkability × load sanitizer

Measured: `isPointWalkable(-20.4, 18.3, 0.48)` = **false** (the zone center sits on decoration); the other three zone centers are walkable. Consequences:

1. **Gameplay is unaffected** — the walkable ring begins ~1.5 m from the center, well inside the 5.2 m discovery radius; players walking the Hollow trigger the discovery normally (the walkable-offset probe lists eight in-zone walkable points).
2. **QA methodology** — a save parked exactly at the Sorrel center is reset to safe spawn by the load sanitizer's non-walkable guard (correct anti-stuck behavior), so browser staging must park on in-zone walkable ground (G1 uses the walkable Marigold center).
3. **Disposition: documented, no code change** — "fixing" it would mean either moving the zone center (changes Build-10 data) or relaxing the sanitizer (anti-stuck regression). Neither is justified. Recorded here and in the deferred register (F-WORLD-1) as a QA gotcha with exact coordinates.

## Unit-level vs browser-level verification (explicit separation)

| Behavior | Unit-level (automated suites) | Browser-level (this document) |
|---|---|---|
| Discovery grant/idempotency/persistence | BD10-01…09 | G1 (grant + reload + journal row) |
| Wilds topic registration + selection | BD10-10…13, dialogueRegistry | G2 (topic renders through the real dialogue sheet) |
| Offer/accept gating + window | invitations suite, LRTL-02 | G3 (offer topic + acceptance through the UI) |
| Entry + occupancy triple | LR2-01, occupancy suite | G4 ([E] door, toast, triple in autosave) |
| Drift backstop | LRTL-05, LR2-03 | G5 (static + dynamic variants, visible refusal) |
| Mid-visit round trip | LRTL-07, LR2-15/16 | G6 (real reload) |
| Global stability | BD10-08/09, full suite | G7 (movement, time, mobile, error audit) |

## Staging methodology notes (honest disclosure)

- The G4 happy-path save stages **ordinary ambient life** (Sora chatting with Clara — with the runtime `socialPartnerId` mirrors the production formation code sets) so the fresh world's zero cooldowns cannot pull the host into a chat on the first tick. Without it, the entry correctly refuses via the G5 path (that refusal was observed live and is itself Decision A evidence). No invitation-related state is staged beyond what the production offer/accept reducers create.
- The player is staged carrying the `chalk_bundle` world prop (its carryable target otherwise outranks the door at the parking spot). `enterNookAction` places held props automatically — ordinary behavior.
- Nora's discoverability staging sets `flags.foundPostcard` (the designed story gate) + friendly affinity — identical to the unit fixtures (NR-01 documents why).
- Software-GL pacing throttles the simulation (~1–2 in-game minutes per 10 s); interactive-target prompts sync from the throttled rAF loop, so the runner polls for prompts (up to 30 s) before dispatching [E].
