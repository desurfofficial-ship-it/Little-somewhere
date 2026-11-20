# 16 — LR-1 / LR-2 Acceptance Test Plan

**Role**: Independent QA and gameplay architecture review  
**Authority**: `14-revised-architecture.md` (spec of record) and `15-implementation-readiness-checklist.md`  
**Verified base**: Canonical Build 8, `CURRENT_SCHEMA_VERSION = 9` (`src/game/migrations.ts`)  
**Scope**: LR-1 (invitation foundation) and LR-2 (Linden Book Nook occupancy + `share_featured_reading`)  
**Revised**: against `17-acceptance-plan-audit.md`. Teaching is not an LR-2 gate.  
**This document does not implement tests or change gameplay code.**

## Legend

| Mark | Meaning |
|------|---------|
| **Existing** | Function or field present in Build 8 source |
| **Proposed** | Named by document 14; not in the tree until LR implementation |
| **Host** | Nora for all LR-2 occupancy cases. Clara may appear only as a second-offer attempt. |

Pass/fail is binary. A case fails if any expected result is missing, if an existing nook counter changes when the contract says it must not, or if affinity/memory rules are violated.

A case that only calls a proposed helper does not satisfy a path case. Path cases must enter through the existing caller named in the case.

---

## 0. Existing Functions the Plan Relies On

| Symbol | Location | Role in these tests |
|--------|----------|---------------------|
| `advanceToNextDay` | `src/game/storage.ts` ~422 | **Existing.** Day roll, wake at `NEXT_DAY_WAKE_MINUTE` (480), eject from nook/bakery, reset `npcRuntime` via `createInitialNpcRuntime`, clear `activeEncounters`. Must call proposed reconcile. |
| `loadWorldState` / `saveWorldState` | `src/game/storage.ts` ~56 / ~401 | **Existing.** Persistence round-trip. |
| `CURRENT_SCHEMA_VERSION`, `migrateV8ToV9` | `src/game/migrations.ts` | **Existing.** Chain ends at v9. LR migration is current+1 at merge, not a hardcoded future version. |
| `handleAdvanceTwoHours` | `src/App.tsx` ~837 | **Existing.** Today spreads `minuteOfDay` via `advanceSimulationClock` only. LR must route it through expiry. |
| `advanceSimulationClock` | `src/game/time.ts` ~32 | **Existing.** Clamps a minute delta. Used by +2h and by the sim tick. |
| `stepSimulationInPlace` | `src/game/simulation.ts` ~604; minute write ~620 | **Existing.** Advances `minuteOfDay` every unpaused frame. Must reconcile expiry. Must not write occupancy. |
| `recordPlayerTalkAffinity` | `src/game/relationships.ts` ~286 | **Existing.** Smalltalk cap `DAILY_SMALLTALK_AFFINITY_CAP` (20). Offer dialogue must not use a positive delta. |
| `isResidentGuarded` | `src/game/relationships.ts` ~85 | **Existing.** Offer gate. |
| Nook browse / tea reducers | `src/game/actions.ts` ~2695 / ~2744 | **Existing.** Stamp `shelfBrowsedDay`, `teaSharedDay`, `booksRead`, `teasShared`. Shared activity must not call them. |
| `enter_nook` / `exit_nook` | `src/game/actions.ts` ~148 / ~149 | **Existing action-type strings** on prop results. Not functions. |
| `enterNookAction` | `src/game/actions.ts` ~2617 | **Existing reducer.** Door enter. Occupancy set hook attaches here. |
| `nook_chair` obstacle | `src/game/bookNook.ts` ~56 | **Existing.** Station used by LR-2. |
| `MAX_NPC_MEMORIES_PER_RESIDENT` | `src/game/memories.ts` ~33 | **Existing.** Host memory must respect the cap. |
| `GOSSIP_MIN_AFFINITY` | `src/game/memories.ts` ~44 | **Existing.** Value 20. Gossip accuracy cases use it. |

## 0.1 Proposed Functions the Plan Calls

These names come from document 14. Tests should import them once they exist. Until then they are specification targets, not source.

| Proposed function | Owner module | Responsibility |
|-------------------|--------------|----------------|
| `offerInvitation` | `src/game/invitations.ts` | Create `offered` active invite or reject |
| `acceptInvitation` | `src/game/invitations.ts` | `offered` → `accepted` |
| `declineInvitation` | `src/game/invitations.ts` | Archive `declined`, `active = null` |
| `expireInvitationsAt` | `src/game/invitations.ts` | Apply `isInvitationLive`; archive `expired` |
| `isInvitationLive` | `src/game/invitations.ts` | Sole validity predicate |
| `reconcileLivingRelationshipsOnDayAdvance` | `src/game/invitations.ts` or `occupancy.ts` | Called by `advanceToNextDay` |
| `advanceClockAndReconcile` | `src/game/invitations.ts` (name illustrative) | The only minute-advance entry +2h and the sim tick may use. Calls `expireInvitationsAt`. |
| `setOccupant` / `clearOccupant` / `clearAllOccupancy` | `src/game/occupancy.ts` | Only occupancy writers |
| `completeSharedActivity` | `src/game/activities.ts` | Sole completion writer |
| `applySharedActivityAffinity` | `src/game/activities.ts` | +6 affinity / +2 reliability, once |

Proposed state slices: `world.invitations`, `world.occupancy`, `world.teaching`, `world.activeActivity`.

Calling `expireInvitationsAt` from a test does not satisfy LR1-05 or LR1-19.

---

## 1. LR-1 — Invitation Lifecycle

### LR1-01 Offer creates a single active invitation
- **Preconditions**: Nora at `friendly` or above; `invitations.active === null`; no offer from her in the last 2 days; she is not guarded.
- **Actions**: Call `offerInvitation(world, 'nora', 'share_featured_reading')`.
- **Expected**: `active.status === 'offered'`; `active.hostId === 'nora'`; `lastOfferDayByHost.nora === world.day`; history unchanged.
- **State**: `InvitationState.active`.
- **Location**: `src/game/invitations.test.ts`
- **Pass**: Exactly one active invite. **Fail**: null active, or history already contains the offer.

### LR1-02 Second offer is rejected
- **Preconditions**: LR1-01 result.
- **Actions**: `offerInvitation` for Clara (or Nora again).
- **Expected**: `ok: false`; `active` still the Nora invite; Clara’s `lastOfferDayByHost` unchanged.
- **Location**: `src/game/invitations.test.ts`
- **Pass**: Still one active invite. **Fail**: two actives, or first invite replaced.

### LR1-03 Accept keeps the slot non-terminal
- **Preconditions**: `offered` Nora invite.
- **Actions**: `acceptInvitation`.
- **Expected**: `active.status === 'accepted'`; `active` non-null; history length unchanged; affinity unchanged.
- **Location**: `src/game/invitations.test.ts`
- **Pass**: Status is `accepted` and slot still occupied. **Fail**: archived early, or affinity moved.

### LR1-04 Decline archives and clears
- **Preconditions**: `offered` invite. Record affinity and `dailyAffinityGained`.
- **Actions**: `declineInvitation`.
- **Expected**: `active === null`; history length +1 with `outcome: 'declined'`; affinity and `dailyAffinityGained` identical; no journal memory; no NPC memory; no knowledge grant.
- **Existing**: `recordPlayerTalkAffinity` must not have been fed a positive delta.
- **Location**: `src/game/invitations.test.ts`
- **Pass**: Slot clear, no rewards. **Fail**: residual `active`, or any affinity/memory write.

### LR1-05 +2h path expires across the window
- **Preconditions**: Accepted invite with `windowEndMinute = 780`. World `minuteOfDay = 779`.
- **Actions**: Run the same entry `handleAdvanceTwoHours` (`App.tsx` ~837) uses after LR wiring. That entry must be `advanceClockAndReconcile` (or equivalent). The test must not call `expireInvitationsAt` itself.
- **Expected**: `minuteOfDay` advanced by 120 via `advanceSimulationClock`; `isInvitationLive` false; `active === null`; history `outcome: 'expired'`; occupancy empty; no affinity change.
- **Fail closed**: If the handler still only spreads `minuteOfDay`, this case fails even if a separate unit test of `expireInvitationsAt` passes.
- **Location**: `src/game/invitations.test.ts`
- **Pass**: Expiry is a consequence of the +2h path. **Fail**: invite still `accepted`, or the test had to call `expireInvitationsAt` directly.

### LR1-06 Boundary: minute equal to window end is live
- **Preconditions**: `windowEndMinute = 780`, `minuteOfDay = 780`, `day <= expiresDay`.
- **Actions**: `isInvitationLive`.
- **Expected**: true.
- **Pass**: Inclusive end. **Fail**: expired at the equal minute.

### LR1-07 Boundary: minute equal to window start is live
- **Preconditions**: `windowStartMinute = 600`, `minuteOfDay = 600`.
- **Actions**: `isInvitationLive`.
- **Expected**: true.
- **Pass**: Inclusive start. **Fail**: not yet live at the start minute.

### LR1-08 Offer rejected when host is guarded
- **Preconditions**: `isResidentGuarded` true for Nora.
- **Actions**: `offerInvitation`.
- **Expected**: `ok: false`; `active` stays null.
- **Location**: `src/game/invitations.test.ts`
- **Pass**: No offer. **Fail**: invite created.

### LR1-09 Offer rejected inside spacing window
- **Preconditions**: `lastOfferDayByHost.nora === world.day - 1`; min days is 2.
- **Actions**: `offerInvitation`.
- **Expected**: `ok: false`.
- **Pass**: Spacing holds. **Fail**: second offer inside 2 days.

### LR1-09b Spacing boundary is allowed
- **Preconditions**: `lastOfferDayByHost.nora === world.day - 2`; min days is 2; no other active invite; Nora not guarded.
- **Actions**: `offerInvitation`.
- **Expected**: `ok: true`; one `offered` invite.
- **Pass**: Equal to min days succeeds. **Fail**: rejected at the boundary.

### LR1-10 Unavailable NPC cannot be invited
- **Preconditions**: Nora’s current phase slot target is > 6 m from `homePos`, or she is in `activeEncounters`.
- **Actions**: `offerInvitation`.
- **Expected**: `ok: false` with reason `host_unavailable` (or equivalent); `active` null.
- **Existing**: schedule slots in `residents.ts`; encounters on `WorldState.activeEncounters`.
- **Location**: `src/game/invitations.test.ts`
- **Pass**: No invite. **Fail**: invite whose window cannot be honored.

### LR1-19 Live sim clock expires across the window
- **Preconditions**: Accepted invite, `windowEndMinute = 780`, `minuteOfDay = 779`, occupant set for `nook_interior`, player inside. Unpaused, dialogue closed.
- **Actions**: Call `stepSimulationInPlace` (**Existing**) with a `dt` large enough that `advanceSimulationClock` moves `minuteOfDay` past 780. The test must not call `expireInvitationsAt`.
- **Expected**: `minuteOfDay > 780`; `active === null`; history `outcome: 'expired'`; occupancy empty. `stepSimulationInPlace` did not create or move an occupant.
- **Fail closed**: Passing a direct `expireInvitationsAt` test does not satisfy this case.
- **Location**: `src/game/invitations.test.ts` or `src/game/simulation.test.ts`
- **Pass**: Sim tick is sufficient to expire and clear. **Fail**: invite or occupant survives the tick.

### LR1-20 Day past expiresDay is not live
- **Preconditions**: `expiresDay = world.day - 1`; `minuteOfDay` inside `[windowStartMinute, windowEndMinute]`.
- **Actions**: `isInvitationLive`.
- **Expected**: false. A following `expireInvitationsAt` archives `expired` and nulls `active`.
- **Pass**: Day bound wins over a valid minute. **Fail**: still live.

### LR1-23 History cap
- **Preconditions**: History already at the documented cap (12 unless the impl doc sets another bound).
- **Actions**: Decline or expire one more invite.
- **Expected**: History length stays at the cap; oldest entry dropped; new terminal entry present; `active === null`.
- **Location**: `src/game/invitations.test.ts`
- **Pass**: Cap holds on write. **Fail**: length grows past the cap.

---

## 2. Day Advancement and Sleep

### LR1-11 Sleep archives an accepted invite
- **Preconditions**: Accepted Nora invite; player may be exterior or inside the nook.
- **Actions**: `advanceToNextDay(world)` (**Existing**, `storage.ts`).
- **Expected**:
  - `day` increased by 1
  - `minuteOfDay === 480` (`NEXT_DAY_WAKE_MINUTE`)
  - `invitations.active === null`
  - history contains `expired`
  - `occupancy` empty
  - `activeActivity === null`
  - if player was in the nook, `playerLocation === 'exterior'` and position is the nook porch (existing ejection)
  - `npcRuntime` replaced (existing `createInitialNpcRuntime`)
  - `nookState` day stamps unchanged (existing behavior)
- **Proposed**: `reconcileLivingRelationshipsOnDayAdvance` must run inside `advanceToNextDay`, not after a later tick.
- **Location**: `src/game/invitations.test.ts` and/or `src/game/storage.test.ts`
- **Pass**: All of the above from one call. **Fail**: invite still active, or occupancy left set.

### LR1-11b Sleep archives an offered invite
- **Preconditions**: `offered` (not accepted) Nora invite. No occupant.
- **Actions**: `advanceToNextDay`.
- **Expected**: `active === null`; history `outcome: 'expired'`; no affinity change; no memory.
- **Pass**: Offered invites do not survive sleep. **Fail**: still `offered` next day.

### LR1-12 Sleep does not punish
- **Preconditions**: Affinity and reliability recorded; accepted invite.
- **Actions**: `advanceToNextDay`.
- **Expected**: Affinity unchanged by the expire path. `dailyAffinityGained` reset to 0 only because `advanceToNextDay` already does that for every resident.
- **Pass**: No negative affinity. **Fail**: affinity dropped because an invite expired.

### LR1-13 Interrupted session: +2h then sleep
- **Preconditions**: Accepted invite, minute just below `windowEnd`.
- **Actions**: Run the LR1-05 path, then `advanceToNextDay`.
- **Expected**: First step archives once; second step finds `active === null` and does not append a second history row.
- **Pass**: One history entry. **Fail**: duplicate `expired` rows.

---

## 3. Save / Load and Migration

### LR1-14 Round-trip of a live offered invite
- **Preconditions**: `offered` invite, player exterior.
- **Actions**: `saveWorldState` then `loadWorldState` (**Existing**).
- **Expected**: `active` restored with same id, host, window; `schemaVersion` is the post-LR version (current at merge + 1, not a hardcoded number).
- **Location**: `src/game/storage.test.ts`
- **Pass**: Invitation fields that are persistent match. **Fail**: active lost or status flipped.

### LR1-15 Load clears inconsistent occupancy
- **Preconditions**: Crafted save where occupancy is set for `nook_interior`, but `playerLocation === 'exterior'` (or occupant `invitationId` ≠ `active.id`).
- **Actions**: Load through the sanitizer.
- **Expected**: Occupancy cleared. If `active` is non-live, it is archived or cleared. No throw.
- **Proposed**: load invariant in document 14 §4.3.
- **Location**: `src/game/occupancy.test.ts` or `storage.test.ts`
- **Pass**: No occupant while player is outside. **Fail**: occupant survives, or load throws.

### LR1-15b Load clears orphan activeActivity
- **Preconditions**: Save with `activeActivity` set and `invitations.active === null`.
- **Actions**: Load.
- **Expected**: `activeActivity === null`. Other slices intact.
- **Pass**: Orphan cleared. **Fail**: activity remains without an invite.

### LR1-16 Corrupted invite id
- **Preconditions**: Save with `active.id` unknown and `hostId` not a `ResidentId`.
- **Actions**: Load.
- **Expected**: Active cleared; warning allowed; rest of world intact (`nookState`, relations, memories).
- **Pass**: Sanitized world. **Fail**: crash, or unknown host kept.

### LR1-17 Migration from current canonical save
- **Preconditions**: Fixture at schema 9 (today’s `CURRENT_SCHEMA_VERSION`) with populated `nookState`, `bakeryState`, `greenhouseState`.
- **Actions**: Run the LR migration. Target version is `CURRENT_SCHEMA_VERSION + 1` at merge time. Do not hardcode a future version in the test expectation beyond “one greater than the fixture’s pre-LR version.”
- **Expected**: Prior slices unchanged; `invitations.active === null`; history empty; occupancy empty; `teaching.known` empty; `activeActivity === null`.
- **Existing**: `migrateV8ToV9` remains in the chain below the new step.
- **Location**: `src/game/storage.test.ts`
- **Pass**: v9 interiors preserved. **Fail**: nook/bakery fields reset, or two migrations claim the same target.

### LR1-18 Migration from older than v9
- **Preconditions**: Fixture that currently enters at v8 and is migrated by `migrateV8ToV9`.
- **Actions**: Full load path.
- **Expected**: Chain still reaches the LR version; v9 nook defaults applied by existing migration; LR defaults applied after that.
- **Pass**: No skipped step. **Fail**: LR fields missing on a v8-origin save.

---

## 4. LR-2 — Occupancy, Exclusivity, Completion

### LR2-01 Enter during a live invite places Nora
- **Preconditions**: `accepted` live invite for `nook_interior`; Nora schedule slot within home radius; not in an encounter; player at the nook door.
- **Actions**: Call `enterNookAction` (**Existing** reducer, `actions.ts` ~2617). The `enter_nook` string is only the action type that UI uses to reach this reducer.
- **Expected**: `playerLocation === 'nook_interior'`; occupant has `residentId: 'nora'`, `stationId` is the declared chair station (`nook_chair` unless the impl doc names another), `invitationId === active.id`.
- **Pass criterion**: Occupant present and linked after `enterNookAction`. Naming `setOccupant` is optional; the observable is the occupant record.
- **Location**: `src/game/occupancy.test.ts`
- **Pass**: Occupant present and linked. **Fail**: interior empty, or occupant without a live invite.

### LR2-02 Enter after expiry does not place her
- **Preconditions**: Invite window already past, or day advanced.
- **Actions**: `enterNookAction`.
- **Expected**: No occupant. If a stale `accepted` object was still present, it is archived on enter. Player still enters (existing door behavior preserved).
- **Pass**: Empty nook, invite not left `accepted`. **Fail**: Nora appears with a dead invite.

### LR2-03 Enter when Nora is unavailable expires visibly
- **Preconditions**: Accepted invite, but Nora’s runtime/schedule is distant or she is in `activeEncounters`.
- **Actions**: `enterNookAction`.
- **Expected**: Occupancy not set; invite archived `expired` with reason `host_unavailable`; result includes a player-visible line. No memory, no affinity change.
- **Pass**: Explicit failure, not a silent empty room. **Fail**: empty room with invite still `accepted`.

> **Staging note (doc 21 §1.6, 2026-11-20):** under the offer-time gate-4 reading, the "schedule is distant" precondition is reachable in production by offering in the morning phase (fresh world, minute 495 — Nora at home) and advancing the clock past minute 690 via a production path (`advanceClockAndReconcile` or `stepSimulationInPlace`) before entering; the invite stays live (window `[495/600…780]`) while her slot is West Bench (≈7.56 m > 6 m). Stage BOTH paths as required regression tests: (i) static schedule drift as above; (ii) dynamic drift — accept, pull Nora into `activeEncounters`, enter.

### LR2-04 Exit clears occupancy
- **Preconditions**: LR2-01 state.
- **Actions**: Exit reducer paired with `exit_nook`.
- **Expected**: `playerLocation === 'exterior'`; occupancy cleared; invite still `accepted` if still live.
- **Pass**: No occupant outdoors; invite survives a mere exit. **Fail**: occupant stuck, or invite completed by leaving.

### LR2-04b Already inside when the window opens
- **Preconditions**: Player already in `nook_interior` via `enterNookAction` before the window. Invite exists but `minuteOfDay < windowStartMinute`. No occupant.
- **Actions**: Advance time into the window using the LR1-05 or LR1-19 path. Do not exit or re-enter.
- **Expected**: Occupancy still empty. Nora does not appear retroactively. After `exit` and a new `enterNookAction` while the invite is live, occupant is set.
- **Pass**: No retroactive occupancy. **Fail**: occupant appears without a new enter.

> **Staging note (doc 21 §2, 2026-11-20 — precondition restaged, invariant unchanged):** the literal precondition `minuteOfDay < windowStartMinute` is unreachable through normal invitation creation: doc 14 §2.4's strict predicate expires a pre-window invite at the first reconcile, and the created-window anchoring (doc 20 §4) guarantees every offered invite is live at creation (`windowStartMinute ≤ offerMinute`). Restage the SAME invariant through a production-reachable path: player already inside `nook_interior`; `offerInvitation` at minute 495 (anchored window `[495…780]`, live at creation); advance into/through the window via a production clock path without exiting → occupancy stays empty at every step; exit + fresh `enterNookAction` while live → occupant set. Assertions and Pass/Fail criteria above are unchanged. Optional adversarial companion (doc 21 §2.5 Option B): in-memory fixture with a future `windowStartMinute` jumped past in one clock step — a tick-based path expires the invite pre-window (§2.4), so its expected outcome is "expired, no retroactive occupant".

### LR2-05 Shared read does not touch nook counters
- **Preconditions**: Occupant present; record `shelfBrowsedDay`, `teaSharedDay`, `booksRead`, `teasShared`.
- **Actions**: `completeSharedActivity(world, 'share_featured_reading')`.
- **Expected**: Those four fields identical. Journal has exactly one new memory with the activity’s id. Nora’s `npcMemories` gained one entry. No other resident gained a memory.
- **Existing**: browse/tea reducers in `actions.ts` must not have been called.
- **Location**: `src/game/activities.test.ts`
- **Pass**: Counters unchanged, one host memory. **Fail**: any of the four fields moved.

### LR2-06 Station exclusivity
- **Preconditions**: Live accepted invite, player inside, occupant set.
- **Actions**: Attempt the existing armchair sit / browse path while the invite holds the station.
- **Expected**: Sit or browse rejected or suppressed. `shelfBrowsedDay` unchanged. Occupancy unchanged.
- **Location**: `src/game/activities.test.ts`
- **Pass**: Ordinary station action does not commit. **Fail**: browse stamp updates during a live invite.

### LR2-07 Complete twice is idempotent
- **Preconditions**: LR2-05 just succeeded. Memory count = N. Affinity = A. Reliability = R.
- **Actions**: `completeSharedActivity` again with the same activity id.
- **Expected**: `ok: false`; memory count still N; affinity still A; reliability still R; history does not gain a second `completed` row.
- **Location**: `src/game/activities.test.ts`
- **Pass**: Second call is a no-op. **Fail**: duplicate memory or second reward.

### LR2-07b Pre-seeded memory id is a no-op
- **Preconditions**: Journal already contains the activity’s memory id. Invite accepted.
- **Actions**: `completeSharedActivity`.
- **Expected**: `ok: false`; no second memory; no affinity or reliability change; invite not double-archived.
- **Pass**: Existing id blocks the write. **Fail**: second memory or reward.

### LR2-08 Two interaction paths, one completion
- **Preconditions**: Live invite, occupant present. Both the dialogue choice and the chair station button call `completeSharedActivity`.
- **Actions**: Invoke the dialogue path, then the station path (or the reverse).
- **Expected**: First returns `ok: true` and archives. Second returns `ok: false`. One journal memory, one host NPC memory, one affinity application, one reliability application.
- **Location**: `src/game/activities.test.ts`
- **Pass**: Single transaction. **Fail**: either path writes on its own.

### LR2-09 Affinity and reliability boundaries
- **Preconditions**: `dailyAffinityGained === 20`. Affinity = 50. Reliability = 40.
- **Actions**: Complete the shared read.
- **Expected**: Affinity becomes 56. Reliability becomes 42. `dailyAffinityGained` still 20. Offer/accept earlier in the flow added 0.
- **Existing**: cap logic in `recordPlayerTalkAffinity` is not the writer.
- **Pass**: +6 / +2 outside the smalltalk pool. **Fail**: reward swallowed by the cap, `dailyAffinityGained` increased, or reliability unchanged.

### LR2-10 Affinity does not exceed 100
- **Preconditions**: Affinity 97. Reliability 99.
- **Actions**: Complete.
- **Expected**: Affinity 100. Reliability 100 (clamped), not 101.
- **Pass**: Both clamped. **Fail**: either value above 100.

### LR2-11 Decline after accept is impossible; expire still clean
- **Preconditions**: `accepted` invite.
- **Actions**: `declineInvitation` (should no-op or reject); then expire via the LR1-05 path.
- **Expected**: Decline does not archive an accepted invite as `declined`. Expire archives `expired` once.
- **Pass**: No false decline. **Fail**: accepted invite marked declined.

### LR2-13 Gossip does not omnisciently inform others
- **Preconditions**: Completion done. A neighbor with affinity below `GOSSIP_MIN_AFFINITY` (20).
- **Actions**: Run existing gossip selection once.
- **Expected**: Host has the memory. Low-affinity neighbor does not.
- **Location**: `src/game/activities.test.ts`
- **Pass**: Host-only first party. **Fail**: direct write onto another resident.

### LR2-14 Sleep during accepted interior visit
- **Preconditions**: Player inside nook, occupant set, invite accepted and live.
- **Actions**: `advanceToNextDay`.
- **Expected**: Player on nook porch (existing); occupancy empty; invite archived expired; Nora eligible for exterior simulation; `nookState` intact.
- **Location**: `src/game/storage.test.ts`
- **Pass**: No stuck indoor Nora. **Fail**: occupancy still set after wake.

### LR2-15 Load mid-visit, window still live
- **Preconditions**: Save with player in nook, occupant set, invite accepted, minute inside window, same invitation id.
- **Actions**: Load.
- **Expected**: Occupant restored. Invite still `accepted`.
- **Pass**: Consistent triple (location, occupant, invite). **Fail**: any one missing while the others remain.

### LR2-16 Load mid-visit, window no longer live
- **Preconditions**: Save as LR2-15 but `minuteOfDay` past `windowEnd`, or `day > expiresDay`.
- **Actions**: Load.
- **Expected**: Occupancy cleared; invite archived or cleared; player location may remain interior (do not teleport on load) but no occupant.
- **Pass**: Invariant restored without crash. **Fail**: Nora present on a dead invite.

---

## 5. Required Automated Test Locations

| File | Cases |
|------|--------|
| `src/game/invitations.test.ts` | LR1-01 – LR1-13, LR1-09b, LR1-19, LR1-20, LR1-23, LR2-11 |
| `src/game/occupancy.test.ts` | LR1-15, LR2-01 – LR2-04b, LR2-15, LR2-16 |
| `src/game/activities.test.ts` | LR2-05 – LR2-10, LR2-07b, LR2-13 |
| `src/game/simulation.test.ts` | LR1-19 if not placed in invitations tests |
| `src/game/storage.test.ts` | LR1-14, LR1-15b, LR1-17, LR1-18, LR2-14 |
| `src/game/dialogue.test.ts` | Existing suite must stay green |
| `src/scene/bookNookInterior.test.ts` | Optional occupant-anchor visibility. Not a merge blocker if the game-layer cases pass. |

No new test may live only in a manual script.

---

## 6. Pass / Fail for the Milestones

**LR-1 passes only if** LR1-01 through LR1-18, plus LR1-09b, LR1-11b, LR1-15b, LR1-19, LR1-20, and LR1-23 pass; existing dialogue and storage tests still pass; and no test hardcodes a future schema version. LR1-05 and LR1-19 fail if they depend on the test calling `expireInvitationsAt`.

**LR-2 passes only if** all LR-1 cases still pass and LR2-01 through LR2-11, LR2-04b, LR2-07b, and LR2-13 through LR2-16 pass, including:

- sleep during an accepted visit (LR2-14) and sleep while offered (LR1-11b)
- inconsistent occupancy and orphan `activeActivity` on load (LR1-15, LR1-15b, LR2-16)
- enter after expiry (LR2-02)
- no retroactive occupancy (LR2-04b)
- double completion and pre-seeded memory id (LR2-07, LR2-07b)
- two paths, one write (LR2-08)
- unavailable host (LR1-10, LR2-03)
- second active invite rejected (LR1-02)
- nook counters unchanged (LR2-05)
- affinity +6 and reliability +2, `dailyAffinityGained` unchanged (LR2-09)
- sim clock and +2h both expire (LR1-19, LR1-05)
- host-only memory (LR2-13)

**Teaching is not part of either gate.** See §8.

**Either milestone fails if** `handleAdvanceTwoHours` or `stepSimulationInPlace` still only moves `minuteOfDay`, or if completion calls the existing browse/tea reducers.

---

## 7. Out of Scope for LR-1 / LR-2

- Bakery knead/share exclusivity (LR-3)
- Arthur / Copperwheel
- Guest NPCs, passive owner occupancy, noticeboard reminders
- Multi-day windows
- Scene-level animation frame tests
- Teaching and knowledge grants (LR-4; §8)
- Implementing any of the above tests in this task

---

## 8. Future LR-4 — Teaching (not a current gate)

Preserved from the previous plan so the coverage is not lost. These cases do not affect LR-1 or LR-2 pass/fail.

### LR4-01 Knowledge granted once
- **Preconditions**: Activity def has `knowledgeGranted: 'nora_featured_reading'`. First `completeSharedActivity` succeeded.
- **Actions**: Complete a later invited instance of the same activity.
- **Expected**: `teaching.known` length stays 1. No grant field is read from the invitation object.
- **Location**: `src/game/activities.test.ts` when LR-4 is scheduled.
- **Pass**: Granted once, from the activity def only. **Fail**: duplicate id, or grant on decline.

### LR4-02 Decline does not grant
- **Preconditions**: Offered invite whose activity would grant knowledge.
- **Actions**: `declineInvitation`.
- **Expected**: `teaching.known` unchanged.
- **Pass**: No grant. **Fail**: knowledge written on decline.
