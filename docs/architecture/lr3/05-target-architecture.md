# LR-3 Target Architecture

- **Date**: 2026-11-22 (reconciled 2026-11-22, post-integration)
- **Status**: Phase Three deliverable (initiative §3 + §4; contains the §3 special investigation F-ENTER-1 as §9). Docs-only; contains no code changes. No LR-3 production implementation is authorized by this document. Carries 2026-11-22 reconciliation updates marked **[Reconciled]**.
- **Verification basis**: `origin/main` @ `962fb07` (447/447, `tsc` clean — re-verified 2026-11-22, Phase Zero). Every file/function cited exists on that tree; proposed additions are marked **[PROPOSED]**. **[Reconciled 2026-11-22]** re-verified against main `a80a220` (528/528 first-hand): all `actions.ts`/`invitations.ts`/`activities.ts`/`occupancy.ts`/`types.ts`/`residents.ts`/`bakery.ts`/`bookNook.ts` citations are unchanged (files byte-identical); the five reliability-touched files (`migrations.ts`, `storage.ts`, `simulation.ts`, `journal.ts`, `storylines.ts`) and the scene file (`NeighborhoodCanvas.tsx`) shifted — line re-bases are applied below and summarized in §9.5; the reliability integration shipped SR-7 and the sanitizer contracts §12 cites, so §12's gate-conditional row is updated to the unconditional main behavior.
- **Authority basis**: implements the scope of record (doc 03 §1, S1–S8) against the discovery record (docs 01–02) and the gameplay design (doc 04). Governing as-built contracts: doc 14 (spec of record), doc 15, HANDOVER §16/§17, doc 20/21 locked decisions.

---

## 1. Design thesis (what kind of architecture LR-3 is)

LR-3 is a **content-scale milestone on a proven host-agnostic chassis**, plus **two narrowly scoped architecture corrections** that the second venue genuinely forces:

1. **Content (registry/data/dialogue):** the `share_morning_pastry` def, Clara's dialogue quartet, the bakery interaction anchor, station guards, scene occupant path.
2. **Correction 1 — the shared interior-enter reconciliation** (F-ENTER-1's revisit condition now fires): one pure helper adopted by *both* invite-gated venues, replacing the copy-into-`enterBakeryAction` pattern the deferred finding explicitly says to avoid.
3. **Correction 2 — venue-derived legibility strings** (accept toast; completion text): two small, def-driven fixes so the second venue cannot lie to the player (`actions.ts:901`; `activities.ts:223/231/281` — doc 04 F1).

It is **not** a framework, registry-of-registries, activity-lifecycle engine, or resource-lock system. Every boundary decision below was chosen to keep the next venue a *content* addition (doc 12's rule: "Registry is data-driven so later hosts are content, not architecture").

## 2. System dependency diagram

```
                    ┌──────────────────────────  data / registry layer  ─────────────────────────┐
                    │                                                                            │
 residents.ts       bakery.ts                          activities.ts (SHARED_ACTIVITIES)        │
 (RESIDENTS,        (bounds, obstacles,                ├── share_featured_reading (Nora, nook)  │
  schedules,        interactables,                     └── share_morning_pastry  [PROPOSED def] │
  RESIDENT_EXTRA)   BAKERY_SEAT_SPOTS)                     ▲  ▲                                 │
        │           │                                      │  │                                 │
        │           │                    invitations.ts ────┘  │  (canOffer, windows, lifecycle) │
        │           │                    ├── isHostAvailableForActivity (:59)                │
        │           │                    ├── isInvitationLive / isInvitationExpired (D-03)   │
        │           │                    ├── canOfferInvitation / offer/accept/decline/expire │
        │           │                    ├── reconcileInvitedInteriorEntry  [PROPOSED helper]   │
        │           │                    └── expireInvitationsAt / InPlace / OnDayAdvance      │
        │           │                                    │                                     │
        │           │            occupancy.ts ───────────┘  (setOccupant / clearOccupant /      │
        │           │                                   isStationOccupied; single global slot)  │
        ▼           ▼                                    ▼                                     │
 actions.ts  ────────────────────────► activities.ts: completeSharedActivity  (single transaction)│
 (enter/exit reducers,                                          │                                │
  station guards,                                               ▼                                │
  dialogue choice wiring)                          relationships.ts (affinity), memories.ts      │
                                                   (host memory), journal.ts (memory card),      │
                                                   worldEvents (pushWorldEventInPlace)           │
                                                                                                  │
 simulation.ts (tick: expireInvitationsInPlace :623, occupant skip :653-656, pure clone :1106 [Rec])    │
 storage.ts   (advanceToNextDay → reconcileLivingRelationshipsOnDayAdvance :670 [Rec]; dawn eject :555-648) │
 migrations.ts (sanitizer LR block :1532-1844 [Rec]; v10→v11 :2401-2410; SCHEMA=11 :137)     │
 dialogue/ (dialogueEngine conditions :473-505; invitations/nora.ts; clara.ts [PROPOSED];          │
           invitations/index.ts aggregator; dialogue-topics-golden.json compatibility contract)   │
 scene/ (NeighborhoodCanvas occupant rig :945-961/:1477-1502/:2086-2137 [D8 param; Rec a80a220];     │
         builders/bakeryInterior.ts hit proxies :954-967)                                         │
                    └─────────────────────────────────────────────────────────────────────────────┘
```

Import discipline (verified acyclic): `activities.ts` already imports `bookNook.ts` and `occupancy.ts`; adding `bakery.ts` (for seat constants + bake roster text) introduces no cycle (`bakery.ts` imports only `types` + `worldMap`). The proposed enter helper lives in `invitations.ts`, which may import `occupancy.ts` (no back edge). **Do not** import `invitations.ts` from `occupancy.ts` — that would close a cycle (`occupancy → invitations → activities → occupancy`).

## 3. Lifecycle diagram — complete transition map with single owners

```
 INVITATION OFFER ──── owner: offerInvitation (invitations.ts:209) via dialogue choice (actions.ts:887)
   │  gate: canOfferInvitation (:159) — active-slot, spacing, guard, tier/affinity,
   │        availability (schedule-radius + encounter), [PROPOSED] offerPhases check (D2)
   │  window: computeOfferWindow (:127) — morning offer for Clara caps at 719 (away-afternoon rule)
   ▼
 OFFERED ──┬── accept ─── owner: acceptInvitation (:255) via dialogue choice (:897)
           │               live check mandatory; toast venue-derived (D6 fix)
           ├── decline ── owner: declineInvitation (:284) — archives 'declined', rewards nothing
           └── expire ─── owner: expireInvitationsAt (:319) / expireInvitationsInPlace (:384)
                           triggers: tick boundary (simulation.ts:623), +2h (advanceClockAndReconcile),
                           enter reconcile, day advance ('day_end')
 ▼
 ACCEPTED ──┬── enter venue ─── owner: THE ENTER REDUCER via [PROPOSED] reconcileInvitedInteriorEntry
            │   (nook: enterNookAction; bakery: enterBakeryAction) — the ONLY occupant writer
            │   live+available  → setOccupant + activeActivity + arrival line
            │   live+unavailable→ expire 'host_unavailable' (visible; NO phantom occupant)
            │   not live        → archive 'expired' (visible line; enter still succeeds)
            ├── host drift ─── owner: the ENTER reducer only (doc 21 §1.4 Decision A; LRTL-05 pin);
            │                   completion re-checks encounters only (D-04/H-1, activities.ts:209)
            ├── exit venue ─── owner: exit reducer (exitNookAction:3036 / exitBakeryAction [add clear])
            │                   clearOccupant(location) + activeActivity=null; invite stays accepted+live;
            │                   re-enter re-places occupant (idempotent)
            └── complete ───── owner: completeSharedActivity (activities.ts:161) — the ONLY reward writer
                                via dialogue choice completeSharedActivityId (actions.ts:213-232)
                                or station card actionType (App.tsx:961-975 [Rec a80a220])
                                rejects: unknown_activity / no_matching_accepted_invitation /
                                host_mismatch / invitation_expired / wrong_location /
                                occupant_not_present / host_unavailable(encounter) / already_completed
 ▼
 TERMINAL ('completed' | 'declined' | 'expired') ── archived in capped history (cap 12)
            day advance ────── owner: reconcileLivingRelationshipsOnDayAdvance (:419) forced 'day_end';
                                dawn ejects interior player (storage.ts:555-648 [Rec a80a220])
            save/load ──────── owner: sanitizeLivingRelationships (migrations.ts:1532-1844 [Rec])
                                non-live actives archived; activeActivity/occupancy coherence enforced
```

**State-ownership rule (doc 14 §4.3 / LR1-15b, binding):** occupancy is written **only** by the interior enter reducer (through the shared helper); the tick never creates occupants; `activeActivity` anchors to the live active invitation; every expiry path uses the single strict predicate (D-03 duality, HANDOVER §16/§17). No LR-3 code may add a second writer for any of these decisions.

## 4. File ownership map (grounded in `962fb07`)

Legend: **[UNCHANGED]** = no modification; **[CONTENT]** = data/registry/dialogue addition; **[ARCH]** = behavior mirrored/guarded/corrected; **[PROPOSED]** = new symbol (does not exist on main).

| File | Owning module / responsibility | Relevant existing functions & tests | Required LR-3 changes |
|---|---|---|---|
| `src/game/activities.ts` | Shared-activity registry + completion transaction | `SHARED_ACTIVITIES` (:52), `completeSharedActivity` (:161), `applySharedActivityAffinity` (:87); `activities.test.ts` LR2-05…13 | **[CONTENT]** add `share_morning_pastry` def (§6.1); **[ARCH]** def-level text composition for memory/world-event summaries (F1 fix, §6.2) — Nora's visible strings byte-identical |
| `src/game/invitations.ts` | Invitation lifecycle, windows, expiry, availability | full file (439 lines); `invitations.test.ts` LR1-01…23; `lr-tick-load.test.ts` | **[ARCH]** add [PROPOSED] `reconcileInvitedInteriorEntry(world, location)` (§5) + [PROPOSED] optional `offerPhases` check inside `canOfferInvitation` (§7.2); everything else [UNCHANGED] |
| `src/game/occupancy.ts` | Occupant slot owner | `setOccupant`/`clearOccupant`/`isStationOccupied` (:29-86); `occupancy.test.ts` LR2-01…04b, 15/16 | **[UNCHANGED]** |
| `src/game/actions.ts` | Enter/exit reducers, station cards/guards, dialogue-choice wiring | `enterNookAction` (:2960-3034), `exitNookAction` (:3036-3055), `interactWithNookProp` nook_chair branch (:3071-3093), `browseBookshelfAction` guard (:3111-3123), sit guard (:979-988), accept toast (:897-907), bakery reducers (:2664-2934); LR2 suite, BD10-10/11 | **[ARCH]** enterBakery/exitBakery adopt shared helper + clear (§5.3); enterNook refactored onto helper (byte-identical observable behavior); **[CONTENT]** `bakery_cafe_table` station branch; **[ARCH]** three bakery station guards (§6.4); **[ARCH]** D6 toast derivation (:901); **[CONTENT]** sit guard for `bakery_seat_cafe_west` (mirror :979-988) |
| `src/game/bakery.ts` | Venue geometry, seat, bake roster | `BAKERY_SEAT_SPOTS` (:297-308), `getBakeForDay` (:163); `bakery.test.ts` | **[CONTENT]** `bakery_cafe_table` interactable entry + shared-session card labels exported as constants for the reducer (§6.3); no geometry changes |
| `src/game/residents.ts` | Characters, schedules, extra activities | Clara :29-88; extras :680-751 | **[UNCHANGED]** |
| `src/game/types.ts` | WorldState v11 contracts | `InteriorOccupant` (:618), `ActiveSharedActivity` (:631), def fields (:868-906) | **[CONTENT]** optional `SharedActivityDef` fields: `offerPhases?`, `arrivalLine?`, summary composition (§6.2); no WorldState shape change → **no schema bump** |
| `src/game/migrations.ts` | v11 chain + sanitizer | sanitize LR block (:1532-1844 [Reconciled a80a220]; **SR-7 stationId registry resolution shipped at :1772-1773**; window-domain clamp :1569-1593; `expiresDay` re-pin :1608-1614; non-live archive :1696-1714; `activeActivity` anchor :1716-1755; SR-2b restore :1810-1823 — all pinned by `save-integrity.test.ts`, 37 cases) | **[UNCHANGED]** under D7 (registry-only) — the reliability integration's sanitizer already covers every state shape LR-3 will write (verified against the def in §6.1: `SHARED_ACTIVITIES[activityId].hostId === hostId` at :1606 validates Clara invites the moment the def registers; stationId is resolved against the registry at :1772-1773). LR-3 adds **no new sanitizer rule**; §12's table carries the unconditional main behavior |
| `src/game/simulation.ts` | Tick, occupant skip, purity | expire (:623), skip (:653-656), clone (:1106-1117 [Reconciled a80a220]; residents per-record clone :1059-1072) | **[UNCHANGED]** (skip is already resident-generic) |
| `src/game/storage.ts` | Day advance, round-trip | `advanceToNextDay` → LR reconcile (:670 [Reconciled a80a220]) | **[UNCHANGED]** |
| `src/game/journal.ts` | Pocket journal | invitation card :1183-1200 [Reconciled a80a220] (registry-generic) | **[UNCHANGED]** |
| `src/game/dialogue/invitations/clara.ts` **[PROPOSED]** | Clara invitation quartet | pattern: `nora.ts` (198 lines) | **[CONTENT]** four topics (§8) |
| `src/game/dialogue/invitations/index.ts` | Aggregator | spreads NORA (:4-6) | **[CONTENT]** spread CLARA_INVITATION_TOPICS |
| `scripts/dialogue-topics-golden.json` | Compatibility contract (85 topics) | `dialogueRegistry.test.ts:44-93` | **[CONTENT]** regenerate 85 → 89 with written justification (HANDOVER §17 convention) |
| `src/App.tsx` | actionType handlers | `share_featured_reading` handler (:961-975 [Reconciled a80a220]) | **[CONTENT]** handle `share_morning_pastry` (or derive activityId from actionType — implementer may generalize the handler if and only if the observable behavior is identical) |
| `src/scene/NeighborhoodCanvas.tsx` | Occupant rig + click routing | rig (:945-961 [Reconciled a80a220]), routing (:1477-1502 [Reconciled], incl. `NOOK_OCCUPANT_APPROACH_POS` defined at `occupancy.ts:21`), sync (:2086-2137 [Reconciled]; BUILD 04 added an `emotionIntensity` reset at :2115-2118 that the parameterization must carry) | **[ARCH]** D8 parameterization (§8) — one venue-agnostic occupant path |
| `src/scene/builders/bakeryInterior.ts` | Bakery scene | hit proxies auto-built from `BAKERY_INTERACTABLES` (:954-967) | **[CONTENT]** nothing beyond the interactable entry (proxy auto-generates); optional seated-dress detail of the café table during an active session is NOT required (restraint) |
| `src/game/occupancy.test.ts` / `activities.test.ts` / `invitations.test.ts` / `dialogueRegistry.test.ts` / venue suites | Regression net | 447/447 baseline | **[CONTENT]** new LR3 battery per doc 06; existing tests stay green |

Explicitly **not** touched (doc 02 §5 verdict, re-verified): `canOfferInvitation` core gates (beyond the additive phase check), tick loop, day-advance reconcile, journal view, memory/gossip systems, storylines, greenhouse/copperwheel/cottage modules, `walkability.ts`, all Build 7 bakery geometry.

## 5. The shared interior-enter reconciliation (F-ENTER-1 resolution — mechanics)

### 5.1 [PROPOSED] `reconcileInvitedInteriorEntry(world, location)` — signature and contract

Lives in `invitations.ts` (ownership: the invitation foundation already owns expiry reconciliation; import direction stays acyclic, §2). Pure function, no allocation-heavy work, deterministic:

```
Input:  world: WorldState, location: InteriorLocation (the venue being ENTERED)
Output: { world, expiryToast?: string, arrivalToast?: string, occupantSet: boolean }

Contract (order is normative):
 1. expiry reconcile: expireInvitationsAt(world, day, minute)          — archives any non-live
    active invitation with the visible generic line (as-built enterNookAction :2973-2979).
 2. active = result.invitations.active; if active && status==='accepted'
    && isInvitationLive(active, day, minute):
      def = getSharedActivityDef(active.activityId)
      if def && def.location === location:
         if isHostAvailableForActivity(result, active.hostId):
            occupant = { residentId: active.hostId, location, stationId: def.stationId,
                         localPos: def.seatPos, facing: def.seatFacing, invitationId: active.id }
            setOccupant + activeActivity = { activityId: def.id, invitationId: active.id }
            arrivalToast = def.arrivalLine(RESIDENTS[host].name)        [PROPOSED def field]
         else:
            expireInvitationsAt(result, day, minute, 'host_unavailable') — visible line; NO occupant
 3. otherwise: no occupancy changes; occupantSet=false.
```

Observable-behavior guarantee: for `location = 'nook_interior'` this is exactly today's `enterNookAction:2972-3018` block (toasts composed identically); the venue reducer keeps its door spawn, exit position, safety fallbacks, and the "Stepped inside …" prefix. Composed toasts: `Stepped inside <venue>.` + optional ` ${expiryToast}` / arrival line replacing the prefix tail exactly as `:2977-2978, 3003` do today. Nora's enter toast is byte-identical after the refactor (pinned by existing tests); Clara's is the same composition with her def's `arrivalLine`.

### 5.2 Why this shape (and not the alternatives) — see §9 for the full F-ENTER-1 investigation and §10 for the approach comparison

- The helper owns **reconciliation**, not doors: venue reducers keep their own I/O geometry (spawn/facing/exit), which is where venue identity legitimately lives.
- Single owner of occupant creation survives (§3 rule) — the helper is *part of* the enter reducer's transaction, not a second writer.
- Two-venue adoption satisfies F-ENTER-1's recorded condition; cottage/greenhouse/copperwheel enters remain untouched (their adoption would be a behavioral no-op today but widens the change surface and reorders toast composition for zero test value — rejected in review, doc 08 §2.1).

### 5.3 Reducer changes

- `enterBakeryAction` (currently reconciliation-free, `actions.ts:2664-2688`): keep held-prop placement + safe exterior pos; call the helper with `'bakery_interior'`; compose the door toast identically to the nook pattern; keep door spawn/facing/posture writes.
- `exitBakeryAction` (:2690-2707): add `clearOccupant(world, 'bakery_interior')` and `activeActivity: null` to mirror `exitNookAction` (:3040, :3051). Location-guarded clear (`occupancy.ts:53-55`) makes this safe even in malformed states (no-op when the occupant belongs to another venue).
- `enterNookAction`: body replaced by the helper call; **all observable behavior preserved** (tests LR2-01/02/03, LRTL-05/06 must stay green unmodified).

## 6. Bakery-specific behavior (S2/S3) — every identifier verified

### 6.1 [PROPOSED] activity def (all values grounded; doc 07 D2 carries the approval flags)

```
share_morning_pastry: {
  id: 'share_morning_pastry',
  hostId: 'clara',                              // residents.ts:29
  title: 'Shared Morning Pastry',
  location: 'bakery_interior',                  // PlayerLocation union, types.ts:39
  stationId: 'bakery_seat_cafe_west',           // the as-built seat id, bakery.ts:299 (D3)
  seatPos: { x: 0.73, z: 1.45 },                // bakery.ts:301
  seatFacing: 1.5708,                           // bakery.ts:303 (computed atan2(0.62, 0) ≈ π/2, east across the table)
  minTier: 'friendly',                          // matches Nora's def (activities.ts:61) — consistent progression floor
  minAffinity: 45,                              // matches Nora's def (activities.ts:62)
  defaultDurationMinutes: 180,                  // same window semantics as Nora (activities.ts:63);
                                                //   Clara's morning cap resolves to ≤ 719 via computeOfferWindow:141-142
  minutesSpent: 15,                             // interface parity with Nora (:64); field currently unconsumed
  affinityDelta: 6, reliabilityDelta: 2,        // doc 15 §3.2 item 5 (binding)
  memoryId: 'mem_lr_clara_morning_pastry',      // naming follows mem_lr_nora_featured_reading (:67)
  memoryTitle: 'First Crackles at the Café Corner',   // Clara-voice title (doc 04 §3.2)
  npcMemoryTag: 'shared_morning_pastry',        // naming follows npcMemoryTag convention (:69)
  offerPhases: ['morning'],                     // [PROPOSED field] D10 — morning-only offers (USER APPROVED 2026-11-21;
                                                //   recorded in docs/architecture/systemic-reliability-integration/08;
                                                //   NOT implemented — implementation is the LR-3 initiative's job)
  arrivalLine: (hostName) => `${hostName} has set today's bake on the café corner and saved you the seat across from her.`,
  // summary composition fields — see §6.2 [PROPOSED]
  // NO knowledgeGranted — teaching is LR-4 (doc 14 §10); the def omits the field entirely
}
```

Verification notes: `seatPos`/`seatFacing`/`stationId` are taken from the pinned seat-spot record (no invented coordinates); the def mirrors `bakery.ts:297-308` — implementation should import the seat spot rather than re-typing literals where the module graph allows (activities → bakery is acyclic, §2), so a future seat-data change cannot drift from the def.

### 6.2 [PROPOSED] venue-aware completion text (F1 fix — minimal, data-driven)

`SharedActivityDef` gains an optional composition field used by `completeSharedActivity` in place of the hardcoded nook strings:

```
summaryCompose?: (world: WorldState) => { memorySummary: string; eventSummary: string };
```

- Nora's def supplies her current text (the exact template now inline at `activities.ts:231` and `:281`, book reference included) — **visible strings byte-identical**, verified against the current literals.
- Clara's def supplies bakery text grounded in the day's roster, e.g. memory: `Split ${getBakeForDay(world.day).label.toLowerCase()} with ${hostName} at the café corner of Hearth & Crumb — first crackles, two cups, and a slow morning kept going.`; event: `Shared the morning pastry with ${hostName} at Hearth & Crumb.`
- `completeSharedActivity` falls back to the current composition **only when the field is absent** so the shape cannot regress Nora; doc 06 pins both venues' journal text.

This is deliberately *a function field on the existing def*, not a summary-builder framework: one def = one voice; the transaction's write set is unchanged (doc 14 §5.1 steps 1–11 remain the contract).

### 6.3 Station & interaction anchors (D3)

| Identifier | Kind | Role | Source |
|---|---|---|---|
| `bakery_seat_cafe_west` | seat spot id / **occupancy stationId** | Clara's claimed seat during the session; player sit refused while claimed | `bakery.ts:297-308` |
| `bakery_cafe_table` **[PROPOSED]** | `BakeryInteractableId` + `BAKERY_INTERACTABLES` entry | Card anchor: when the station is claimed + invite live → "Shared Morning Pastry" card with `actionType: 'share_morning_pastry'`; otherwise a flavor card ("Round café table with two bentwood chairs…") | pattern: `interactWithNookProp` nook_chair branch `actions.ts:3071-3093`; hit proxy auto-generates (`bakeryInterior.ts:954-967`) |
| occupant hit proxy **[PROPOSED]** | scene target | Clicking Clara (targetKind resident) routes to her with `walkDest` = the seat's approach pos and label logic from `activeActivity` — parameterized path (D8, §8) | pattern: `NeighborhoodCanvas.tsx:1454-1472` |

Suggested interactable geometry (for implementer confirmation against walkability tests): pos (1.35, 1.45) (table center, matches obstacle box center), focus toward the approach aisle (≈0.0, 1.45), interactRadius ≈ 1.85 (oven/prep-class value), actionLabel "Share the Morning Pastry". The two-chaired table has clear west/south approach lanes (hubs `(-0.35, 0.35)` and `(2.1, 0.9)`, `bakery.ts:229-236`); walkability + waypoint tests in `bakery.test.ts` must be extended for the new focus point (doc 06 §3).

### 6.4 Station exclusivity rules (S3 — the exact guard matrix)

Guard condition (nook precedent semantics, `actions.ts:3111-3123`): `isStationOccupied(world, 'bakery_interior', 'bakery_seat_cafe_west') || world.activeActivity?.activityId === 'share_morning_pastry'`.

| Interaction | Guarded while condition holds | Behavior | Rationale |
|---|---|---|---|
| `helpKneadDoughAction` (prep) | YES | Visible refusal card, **zero mutation** of `kneadedDay`/`kneadingSessions` | doc 13:91 co-fire hazard; doc 15 §3.2 item 1 |
| `shareMorningLoafAction` (counter) | YES | Visible refusal card, **zero mutation** of `loafSharedDay`/`loavesShared`, **no inventory write** | doc 15 §3.2 item 1; the solo share keeps its own ritual value |
| `checkMorningBakeAction` (oven) | YES | Visible refusal card, **zero mutation** of `bakeCheckedDay`, no +8m clock advance | same-day-stamp hazard class |
| Player sit on `bakery_seat_cafe_west` | YES | Refusal line ("Clara is keeping the café corner for your shared pastry.") — mirror of :979-988 | doc 14 §6.1; §3.1 item 4 of doc 03 |
| `readBakeryNotesAction` (notes shelf) | NO | Unchanged | Different resource; no day-stamp collision with the session; matches nook precedent where desk/tea remain usable during a session |
| Knead/share/oven **on any other day / without the session** | NO | Byte-identical current behavior incl. the knead→double-share bonus | doc 15 §3.2 item 2 (binding no-regression) |

Refusal cards follow the established shape (title + body, no world mutation, no clock advance) exactly like `browseBookshelfAction`'s refusal (:3118-3122). Cleanup ownership of the *claim*: set by enter helper, cleared by complete/expire/exit/day-advance/sanitizer — the same five owners as LR-2 (§3). No new cleanup path is introduced.

## 7. Schedule behavior (S4)

### 7.1 Verified availability surface

- Gate: `isHostAvailableForActivity` — raw `schedule[phase]` slot within 6.0 m of `homePos` + no exterior encounter (`invitations.ts:59-79`; distances verified in doc 04 §1.2).
- Clara's outcome: morning **eligible** (1.020 m); afternoon **blocked** (8.938 m); golden/dusk pass the gate today (5.533 m / 0.0 m) — [PROPOSED] `offerPhases: ['morning']` removes those two from *offer* eligibility while leaving the generic gate intact for any future activity that wants evening windows.
- Window: morning offers cap at **719** by the away-afternoon rule (`computeOfferWindow:141-142`) — the same rule that caps Nora at 719 (her afternoon bench is 7.562 m out). Grounded, not copied: the cap is a property of *Clara's* schedule producing the same constant via the existing computation path (D-17 satisfied — the implementation reuses the function; no new constant is introduced).

### 7.2 [PROPOSED] `offerPhases` check — one line in `canOfferInvitation`

After the existing gates (order: active-slot → def validity → spacing → guarded → tier → **offerPhases [new]** → availability), an optional field: `if (activity.offerPhases && !activity.offerPhases.includes(getTimePhase(world.minuteOfDay))) return { eligible: false, reason: 'offer_phase_closed' }`. Nora's def (no field) is untouched; LR1-01…23 stay green. The new reason string joins the existing refusal vocabulary; dialogue offer topics simply stop surfacing outside morning (read-only eligibility, doc 14 §8).

### 7.3 Window edge semantics (accepted as-built, tested explicitly)

- **The 690–719 dead zone**: an accepted morning invite remains *live* to minute 719, but from 690 the availability gate is false (afternoon slot 8.938 m). Enter at 11:35–11:59 → helper expires with the visible `host_unavailable` line; no occupant; completion likewise rejects (`no_matching_accepted_invitation` is not reachable — the invite is still accepted+live, so the rejection surface is `occupant_not_present` for card interactions, or the enter expiry for the door path). This is today's exact behavior for Nora's window (identical cap) — accepted as-built semantics, covered by an explicit doc 06 case, **not** "fixed" (changing the cap to 689 would alter Nora's pinned window and violate the restraint mandate).
- **Day boundary**: windows never cross days (`expiresDay === offeredDay` enforced by sanitizer domain rules; `DAY_END_MINUTE = 1290`, `time.ts:6`); sleep archives with `day_end`; the next morning's offer is a fresh window (2-day spacing applies to *offers*, `INVITATION_MIN_SPACING_DAYS = 2`).
- **All timing is simulation-clock** (`minuteOfDay`, phases in `time.ts:16-22`) — zero real-world time (design principle 4).

## 8. Scene-layer parameterization (D8)

One venue-agnostic occupant path replaces the nook hardcode, feeding on `occupancy` (single slot guarantees at most one):

1. **Rig**: build one occupant rig **per interior with hosted activities** (today: nook + bakery), each `buildStorybookCharacter(RESIDENTS[def-host].appearance, …)` with its own hit proxy (`targetKind: 'resident'`, `targetId: hostId`) added to that interior's hit list (`NeighborhoodCanvas.tsx:922-939` [Reconciled `a80a220`: `:945-961`] pattern). Rig visibility is driven by `world.occupancy?.location === <interior>`.
2. **Sync block**: generalize `:2062-2109` [Reconciled `a80a220`: `:2086-2137`] to loop over the two (venue, rig) pairs — identical math (seat Y via `computeSitGroundY`, look-yaw clamp ±0.95, ring at < 2.9 m, quest pip via `getResidentAvailableQuestCue`) with venue/host read from the occupancy record. No second math copy.
3. **Click routing**: generalize `:1454-1472` [Reconciled `a80a220`: `:1477-1502`] — `walkDest` = the venue seat's approach position (nook: `NOOK_OCCUPANT_APPROACH_POS`; bakery: `BAKERY_SEAT_SPOTS` approach `(-0.2, 1.4)`), resolved from the *activity def* (`getSharedActivityDef(activeActivity.activityId).stationId` → seat spot table) rather than a module constant; action labels: `Share Reading with Nora` / `Share Morning Pastry with Clara` when `activeActivity` matches, else `Talk to <host>`. Observable behavior for the nook is unchanged (pinned by QA + dialogue tests).
4. **No new scene assets**: Clara's rig, the café chairs, the table dressing all exist (`bakeryInterior.ts:587-645`).

## 9. SPECIAL INVESTIGATION — F-ENTER-1 (the second-interior architectural test)

### 9.1 The finding, verbatim and verified

Reliability branch doc `docs/architecture/systemic-reliability/11-deferred-findings.md` (worktree `b71bb3c`):

> **F-ENTER-1 — Enter-reducer asymmetry — P3, deferred (contract note stands)**
> - **State:** only `enterNookAction` reconciles invitation expiry on room entry; cottage/greenhouse/bakery/copperwheel enters do not.
> - **Why deferred:** harmless today — no invite-gated activity exists outside the nook; the HANDOVER §17 contract note documents the invariant for future interiors.
> - **Revisit when:** a second interior gains an invitation-gated activity (then the reconciliation should move to the shared enter path).

First-hand re-verification on `962fb07`: `enterBakeryAction` (actions.ts:2664-2688) performs **no** expiry reconcile, no live check, no `setOccupant`, and `exitBakeryAction` (:2690-2707) clears no occupancy — while `enterNookAction` (:2960-3034) / `exitNookAction` (:3036-3055) carry the full pattern. The reliability branch itself **implemented no correction** (its diff vs base `545e323` touches migrations/storage/journal/storylines/simulation(+tests) — `actions.ts` is empty in `git diff 545e323..b71bb3c -- src/game/actions.ts`): the branch records the *direction* ("shared enter path"), not the code. The condition now applies — LR-3 is exactly the "second interior with an invitation-gated activity".

### 9.2 Evidence that a dedicated bakery-only copy is the wrong answer

1. The finding's own wording rules duplication out ("the reconciliation should move to the shared enter path").
2. Doc 03 D5's evidence tilt: "Shared helper is the reliability branch's recorded revisit direction for F-ENTER-1; duplication is the pattern it says to avoid."
3. Concretely, a copy-paste of `:2972-3018` into `enterBakeryAction` (doc 02 seam 3's original mirror suggestion) would: hardcode `'nook_interior'`-adjacent literals a third time (the block already names the venue twice in toast strings), leave the stale-invite toast wording venue-coupled, and give the *next* venue (greenhouse? copperwheel?) a third copy — the exact drift F-ENTER-1 exists to prevent.

### 9.3 Is the reliability branch's *direction* still correct against latest main?

Yes — with two refinements. Main's architecture since the branch diverged (BUILD 02 touched `src/scene/*` only; the LR core is unchanged from `545e323` where the branch was written) keeps the enter block byte-compatible with the branch's assumption. Refinements: (a) the helper must live where the import graph stays acyclic (invitations.ts, §2) — a naive "shared enter path" module importing both invitations and occupancy from a new file is also fine, but invites helper sprawl; (b) adoption is **two venues** (nook + bakery), not all five interiors: reconcile-on-enter for cottage/greenhouse/copperwheel would change observable behavior (a stale invitation would start expiring on entering *those* rooms, producing toasts that never fire today) for zero contract value — rejected below. The finding is thereby resolved in design **without copying the branch's implementation** (there is none to copy) and without waiting for the merge (the helper is compatible with the branch's sanitizer/contract work; §10).

### 9.4 Options considered for the F-ENTER-1 correction

| Option | Shape | Verdict |
|---|---|---|
| Duplicate the nook block in `enterBakeryAction` | ~45-line copy, venue literals swapped | **Rejected** — the pattern F-ENTER-1 names; third-copy drift for the next venue |
| Shared reconciliation helper, adopted by both invite-gated venues | [PROPOSED] `reconcileInvitedInteriorEntry` (§5.1); venue reducers keep door geometry | **Recommended** — single owner preserved, observable nook behavior byte-identical, next venue = one call + def data |
| Data-driven venue registry with generic enter dispatch | Registry of venue enter configs consumed by one generic reducer | **Rejected for now** — two venues do not justify a venue-behavior registry; door spawn/exit/toast identity is code-level venue identity, and a registry would obscure it (doc 07 D5 records the re-open condition: a *third* invite-gated interior) |
| General activity-orchestration/lifecycle layer | New lifecycle engine above enter/complete | **Rejected outright** — doc 14 §5.1 names `completeSharedActivity` the single transaction; the initiative forbids frameworks for two venues |

### 9.5 Reconciliation re-verification against integrated main (`a80a220`, 2026-11-22)

First-hand re-verification after PR #11/#12 landed (full suite 528/528 re-run during the reconciliation; `docs/architecture/systemic-reliability-integration/06-deferred-findings.md` now carries F-ENTER-1 verbatim and delegates this investigation to the LR-3 design record):

- The asymmetry is intact: `enterNookAction` (`actions.ts:2960-3034`) is still the only reconciling interior enter (expiry reconcile `:2973-3018` before occupancy `:2991`); `enterCottageAction` (`:2112-2136`), `enterGreenhouseAction` (`:2157-2181`), `enterBakeryAction` (`:2664-2688`), `enterCopperwheelAction` (`:3287-3311`) still do not reconcile; `reconcileInvitedInteriorEntry` has **zero** occurrences in `src/`; `setOccupant` still has exactly one call site (`actions.ts:2991`); the tick still never writes occupancy.
- The reliability merge did **not** touch `actions.ts` (byte-identical `962fb07`→`a80a220`) — §5's reducer contract and §5.1's observable-behavior guarantee are unaffected.
- The contracts §12 cites are now shipped on main (SR-7 `migrations.ts:1772-1773`; window clamp `:1569-1593`; `expiresDay` re-pin `:1608-1614`; anchoring `:1716-1823`) and pinned by `save-integrity.test.ts` (37 cases) — the helper composes with them unchanged: it writes only shapes the sanitizer already validates, and its `host_unavailable`/`expired` archives are the archive paths the sanitizer's step 1 expects.
- BUILD 03/04 shifted the scene regions §8 parameterizes (rig `:945-961`, routing `:1477-1502`, sync `:2086-2137`) and added one `emotionIntensity` reset (`:2115-2118`) that the D8 sync generalization must carry. No new scene constraint contradicts §8.

Conclusion: **the F-ENTER-1 resolution (§5, §9.4) stands unchanged on the integrated tree**; line-number re-bases only.

## 10. Approach comparison (initiative §3.2 A–D) and architectural acceptance condition

| Criterion | A — duplicate venue reconciliation | B — shared helper (recommended) | C — data-driven venue/activity registry | D — activity orchestration layer |
|---|---|---|---|---|
| Complexity | lowest textually, highest cumulatively (N copies) | low: one pure function (~40 lines) | medium: registry schema + dispatch | high: new layer + hooks |
| Existing compatibility | risky (copies drift) | byte-identical nook behavior, pinned by existing tests | requires re-plumbing both enters at once | re-plumbs everything |
| Affected files | 1 (+drift risk) | 2 game files (invitations, actions) + tests | 3-4 + all reducers | most of the LR surface |
| Testability | each copy re-tested | helper unit-tested once + venue tests through public reducers | registry matrix tests | framework test tax |
| Determinism | equal | equal (pure, no clock reads beyond world) | equal | equal |
| Extensibility | copy #3 awaits | next venue: def + call — genuinely content-scale | next venue: config only (premature) | next venue: plugin (over-engineered) |
| Risk of accidental behavior change | high | low (nook path provably identical) | medium | high |
| Justified by two venues? | no | **yes** | no | no |
| Understandable without project history? | deceptively ("why two copies?") | yes — reads as "enter reconciles, then claims" | needs registry doc | needs layer doc |

**Acceptance condition (initiative §3.3), met by B:** adding the bakery does not copy the nook implementation (one shared helper + one def + venue-local door geometry); nothing becomes a generalized framework; the next venue (greenhouse or Copperwheel, LR-4/LR-5 era) needs: a def, an arrival line, a summary composer, a seat spot, one helper call in its enter reducer, its station guards, its dialogue quartet, and its rig registration — each an isolated, testable unit. A future developer can read `invitations.ts → actions.ts(enter) → activities.ts(complete)` top-to-bottom with no project history.

## 11. Determinism requirements

- All LR-3 additions are pure functions of `WorldState` (+ deterministic day-rostered data) — no wall-clock, no `Math.random` (the tick's seeded `mulberry32` domain is untouched).
- The helper is allocation-light and side-effect-free; the tick path remains allocation-free (`stepSimulationInPlace` untouched — purity test stays green, reliability §18 contract).
- Gossip/memory/roster consumers are the existing seeded pipelines (`memories.ts:779+`, `bakery.ts:163`).
- Seeded-replay requirement: identical seed + initial state ⇒ identical offers, windows, expiries, completions (doc 06 §7 battery; extends the LRTL suite's tick/load parity to the second venue).

## 12. Error handling & adversarial posture (summary — full battery in doc 06 §8)

| Malformed condition | Explicit outcome (owner) |
|---|---|
| Active invite references unknown activity / host-activity mismatch | sanitizer clears with classified warning (`migrations.ts:1626` [Reconciled `a80a220`; was :1446-1447]; host-def check `:1606`) |
| `occupancy` inconsistent (wrong location/host/invitation) | sanitizer clears + warns `"inconsistent interior occupancy cleared on load"` (`:1791-1793` [Reconciled; was :1574-1576]); tick orphan-clear (LRTL-06) |
| `stationId` that does not resolve to the activity def | **cleared + classified warning — unconditional on main** [Reconciled 2026-11-22: SR-7 shipped via PR #11 — `migrations.ts:1772-1773` requires `occ.stationId === SHARED_ACTIVITIES[active.activityId].stationId`; pinned by `save-integrity.test.ts` (SR-7 fixture). The former gate-conditional wording ("main silently keeps non-empty strings at :1555-1556") described pre-merge main and is historical] |
| Sanitizer history row missing `activityId` | defaults to `'share_featured_reading'` (`migrations.ts:1649-1652`) [Reconciled `a80a220`: acceptable pre-LR-3 — production writers always set the id; **after LR-3 adds Clara rows, an implementation-time follow-up should generalize this default (def-driven or drop-and-warn) so a hand-edited Clara row cannot be silently mislabeled as a reading**; unreachable from production writers, non-blocking — recorded as doc 08 §6 F-REC-8] |
| Duplicate completion / pre-seeded memory | strict no-op (`already_completed`, `activities.ts:219-221`) |
| Completion while host drifted into an encounter | visible refusal, nothing granted, invite+occupancy left for window-end cleanup (D-04/H-1, `:209-216`) |
| Wrong-venue entry with a live invite | no occupancy, no expiry (helper's `def.location === location` check) — invite survives to be honored at its own door or expire naturally |
| Player sits in claimed chair / uses guarded stations | visible refusal lines, zero mutation (§6.4) |

## 13. Rejected architectural alternatives (register-level summary; full trade-offs in doc 07)

1. Duplicate venue reconciliation (A) — F-ENTER-1 violation.
2. Venue-behavior registry / generic enter dispatch (C) — premature at two venues; re-open at three.
3. Activity orchestration layer (D) — framework for framework's sake; contradicts doc 14's single-transaction contract.
4. Knead-then-share two-station sequence — new sequencing state vs D7; doubles station surface; collides with the solo knead ritual's meaning (doc 04 §3.3).
5. Actual-position availability gate — rewrites the LR-1 predicate, touches pinned LR1-10 semantics, for a divergence that is better *voiced* than *re-architected* (doc 04 §1.3).
6. Offer-window cap change (719 → 689) — would silently alter Nora's pinned window; the 690–719 dead zone is handled visibly and tested instead (§7.3).
7. Player seated during completion — no as-built precedent; participation-by-conversation is the LR-2 contract; zero new posture writes.

## 14. What this document does NOT authorize

No LR-3 production code; no schema changes; no PR merges; PR #3 untouched; PR #7 and PR #8 preserved untouched as the historical discovery/design records. **[Reconciled 2026-11-22]** The reliability-gate condition in the original text ("implementation starts only after doc 03 §5's gate resolves") has resolved — path (a) executed (PR #11 merged `f1c2af4`; PR #12 verification) — but this document still authorizes **documentation only**: the reconciliation initiative may push the unified, verified LR-3 documentation branch and open a reviewable PR (the owner's standing publication directive), and nothing more. Implementation starts only when the owner approves the documentation for merge and opens the LR-3 implementation initiative, which will execute §5/§6/§8 and doc 09 §5 exactly as specified.
