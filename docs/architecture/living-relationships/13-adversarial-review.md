# 13 — Living Relationships Adversarial Review

**Role**: Independent senior gameplay engineer  
**Scope**: Review of `docs/architecture/living-relationships/` (00–12) against canonical Build 8 source  
**Method**: Design claims checked against `src/game/actions.ts`, `storage.ts`, `simulation.ts`, `relationships.ts`, `bakery.ts`, `dialogueEngine.ts`, `types.ts`, `migrations.ts`  
**Rule**: Verified gaps are marked **Verified**. Plausible but unproven failures are marked **Hypothetical**.

This review does not approve the package. It identifies defects that should be resolved before implementation.

---

## Invitation Lifecycle State Machine

```
                    ┌────────────┐
                    │   (none)    │
                    └──────┬──────┘
                           │ offer generated
                           ▼
                    ┌────────────┐
         decline    │   offered   │    expire (window/day)
              ┌─────│             │─────┐
              │     └──────┬──────┘     │
              │            │ accept     │
              ▼            ▼            ▼
        ┌─────────┐ ┌─────────┐ ┌─────────┐
        │ declined │ │ accepted │ │ expired  │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │ complete   │
             │            ▼            │
             │     ┌────────────┐      │
             │     │ completed  │      │
             │     └─────┬──────┘      │
             └──────────┴────────────┘
                         │ move to history, clear active
                         ▼
                    ┌────────────┐
                    │   (none)    │
                    └────────────┘
```

**Defect in the proposed machine**: `completed`, `expired`, and `declined` are statuses on the invitation object, but `InvitationState.active` is a single slot. The design never states the exact transition that nulls `active` and appends history. Without that transition, a completed invite remains “active” and blocks all future offers (doc 03 §3.4 rule 1).

---

## Issues

### LR-A1 — Active slot not cleared on terminal states
- **Severity**: High  
- **Kind**: Verified design gap  
- **Reproduction**: Accept Clara’s invite, complete the activity, reload. If the reducer sets `status: 'completed'` but leaves `active` non-null, doc 03 generation rule 1 (“no other active invitation”) suppresses every later offer forever.  
- **Existing system**: None yet; proposed `InvitationState.active`. Comparable pattern: day-stamped interior fields in `BakeryState` / `NookState` that do not use a mutually exclusive “active object.”  
- **Mitigation**: Terminal transition is mandatory and atomic: append history, set `active = null`, stamp `lastOfferDayByHost`. Status on the archived entry only. Add an invariant test: after complete/decline/expire, `active === null`.  
- **Required test**: Complete, decline, and expire each leave `active` null and history length +1; a new offer can then be generated.

### LR-A2 — Day advance does not know about invitations or occupancy
- **Severity**: Critical  
- **Kind**: Verified integration gap  
- **Reproduction**: Player accepts a bakery invite, enters, then rests until morning (or the clock is advanced through `advanceToNextDay`). `advanceToNextDay` in `src/game/storage.ts` (from ~422) increments `day`, resets `talkedToday` and `dailyAffinityGained`, prunes NPC memories, and **forces the player out of bakery/greenhouse/nook onto the porch** (`wokeInsideBakery` → exterior + `safeBakeryExit`). It does not clear occupancy or expire invitations. Result: Clara remains marked indoors (skipped by exterior sim per doc 08) while the player is outside and the window minute numbers now refer to a new day.  
- **Existing system**: `advanceToNextDay` (`storage.ts`), called from the cottage rest path in `actions.ts` (~1766).  
- **Mitigation**: `advanceToNextDay` must be an explicit participant. On day change: expire any invite whose `expiresDay < nextDay` or whose window cannot survive the wake minute; clear all occupancy; null `activeActivity`; snap any occupant’s exterior runtime to porch/schedule. Do not rely on the 60 Hz loop to notice.  
- **Required test**: Accept invite, enter bakery, call `advanceToNextDay`, assert player is exterior, occupancy empty, invite expired or archived, Clara eligible for exterior simulation.

### LR-A3 — Window vs day model is under-specified
- **Severity**: High  
- **Kind**: Verified design gap  
- **Reproduction**: Invite offered at 18:00 with `windowEndMinute = 1290` and `expiresDay = offeredDay`. Player accepts, then rests. Next day `minuteOfDay` is `NEXT_DAY_WAKE_MINUTE` (8:00). Doc 03 stores both a minute window and an `expiresDay` but does not define precedence when they disagree, nor what happens if the player uses the existing `+2h` HUD advance across the window end without a day change.  
- **Existing system**: Clock is `minuteOfDay` 360–1290 (`time.ts`); day changes only via `advanceToNextDay`, not by reaching 1290.  
- **Mitigation**: Single expiry rule: an accepted invite is valid iff `day === expiresDay` (or `day <= expiresDay` if multi-day is ever allowed) AND `minuteOfDay` is inside `[windowStart, windowEnd]`. Crossing either bound expires it. `+2h` and rest both go through reducers that call the same `expireInvitations(world)` helper.  
- **Required test**: Table of (day, minute, status) including +2h across `windowEnd` and rest across midnight-equivalent.

### LR-A4 — Occupancy restore can desync from playerLocation
- **Severity**: High  
- **Kind**: Hypothetical (follows from proposed persistence)  
- **Reproduction**: Save while occupant is set and `playerLocation === 'bakery_interior'`. Load after a migration sanitizer keeps occupancy but a separate code path has already moved the player exterior (or the reverse: occupancy cleared, player still inside). Doc 07 says occupancy is persisted “so a reload during a visit restores the host”; it does not define the invariant with `playerLocation`.  
- **Existing system**: `playerLocation` + `exteriorPlayerPos` stash on every enter/exit in `actions.ts` (bakery ~2322–2356, nook ~2618–2652).  
- **Mitigation**: Load-time invariant: if `playerLocation` is not the occupant’s location, clear occupancy (or do not restore it). If player is inside and window is invalid, clear occupancy. Never leave an occupant flag set while the player is exterior unless a future “host is home, player is outside” feature is explicitly in scope (it is not for v1).  
- **Required test**: Round-trip save/load in all four combinations of (inside/outside) × (window valid/invalid).

### LR-A5 — Schedule conflict produces a silent empty visit
- **Severity**: High  
- **Kind**: Verified design weakness  
- **Reproduction**: Doc 04/08: if Clara’s current schedule slot is distant (gazebo, square), “occupancy is simply not applied.” Player accepted an invite whose dialogue promised her at the table, enters the bakery, and finds it empty. No dialogue line, no journal note, no expire. Clara is also a high-sociability resident frequently pulled into exterior encounters (`simulation.ts` pairing around the 7.5 m / sociability chance block).  
- **Existing system**: 4-phase exterior schedules in `residents.ts`; encounter pairing in `stepSimulationInPlace`.  
- **Mitigation**: Do not generate an invite whose window overlaps a non-home schedule slot. If a conflict still happens at enter time, expire or pause with an explicit line (“Clara got called to the square — the chair will keep”) rather than a silent miss. Occupancy skip must not be the only behavior.  
- **Required test**: Force Clara’s runtime to a distant exterior target, enter during an accepted window, assert either occupant present or a defined expire/pause outcome with player-visible text.

### LR-A6 — Bakery table is already a seat and a station
- **Severity**: High  
- **Kind**: Verified conflict with existing interior  
- **Reproduction**: `bakery.ts` defines `bakery_table` as an interior obstacle and exposes a sit action (`Sit on ${seat.label}`). Indoor seats are documented as never NPC-claimed (`types.ts` seat comment; `playerController.ts` greenhouse note). Doc 04 places Clara at `bakery_table`. Player can sit there, start the existing knead/share flow (`actions.ts` ~2400–2538, day-stamped `kneadedDay` / `loafSharedDay`), and start `share_morning_pastry` in the same minute.  
- **Existing system**: Bakery contract (`bakery.ts`, `actions.ts` bakery reducers, `bakeryInterior` builder).  
- **Mitigation**: Shared activity must declare exclusive use of the station for its duration. Starting it should be rejected if the player is mid-sit or if today’s knead/share already ran, unless the activity is specified as a pure flavor wrapper that does not call those reducers. Do not “call or mirror” knead/share (doc 06 §6.6) without an idempotence contract — that path double-increments `kneadingSessions` / `loavesShared`.  
- **Required test**: Complete shared pastry after a same-day knead; assert knead counters unchanged. Attempt sit + activity start; assert one wins with a defined rejection.

### LR-A7 — Duplicate completion / double memory
- **Severity**: Medium  
- **Kind**: Hypothetical, high likelihood  
- **Reproduction**: Activity can be started from dialogue (doc 09) and from the station (doc 06). Two reducers both append a journal memory with the same `memoryId` and both try to complete the invite. Existing code usually guards with `world.memories.some(m => m.id === memId)` (e.g. `actions.ts` ~355, ~935, ~1978), but the design does not require that guard.  
- **Existing system**: Journal memory uniqueness checks in `actions.ts`.  
- **Mitigation**: Single `completeSharedActivity(world)` entry point. It no-ops if invite already terminal or memory id already present. Dialogue and station both call it.  
- **Required test**: Fire completion twice; second call returns same world (or ok:false) and memory count stays 1.

### LR-A8 — Affinity double-dip vs daily cap
- **Severity**: Medium  
- **Kind**: Verified ambiguity against existing cap  
- **Reproduction**: Offer/accept happens inside dialogue, which already routes through `recordPlayerTalkAffinity` and `DAILY_SMALLTALK_AFFINITY_CAP` (20) in `relationships.ts`. Doc 03 says completion affinity “does not bypass the existing daily smalltalk cap philosophy” and also allows a “small fixed bonus similar to current story or gift bonuses.” Those two sentences disagree. A talk + activity on the same day can exceed the cap or be silently swallowed.  
- **Existing system**: `recordPlayerTalkAffinity`, `DAILY_SMALLTALK_AFFINITY_CAP`, gift/milestone deltas elsewhere in `actions.ts`.  
- **Mitigation**: Define one rule. Recommended: activity completion uses a separate small delta that ignores the smalltalk cap but is itself capped (e.g. +6, once per activity id per N days), and the offer dialogue grants 0 affinity. Document the numbers.  
- **Required test**: Talk to cap, then complete activity; assert the chosen rule (bonus applied or not) exactly.

### LR-A9 — Gossip / knowledge boundary leak
- **Severity**: Medium  
- **Kind**: Hypothetical if doc 08’s “optionally one nearby close friend” is implemented naively  
- **Reproduction**: Activity completes inside the bakery. Doc 08 suggests writing a memory for the host “and optionally one nearby close friend.” Existing gossip (`memories.ts`) is hop-limited, affinity/tension gated, and non-omniscient (`MAX_GOSSIP_HOPS`, `GOSSIP_MIN_AFFINITY`). A direct memory write to a friend who was outdoors violates the non-omniscience rule the design itself restates in doc 09.  
- **Existing system**: `memories.ts` provenance, hop, and confidence constants; `stampNpcGossipInPlace` in `relationships.ts`.  
- **Mitigation**: Only the host receives a first-party memory. Everyone else learns only through the existing gossip pipeline from a world event. No direct friend write in v1.  
- **Required test**: After completion, only host has the memory; a low-affinity neighbor does not; a close neighbor gains it only if gossip selection actually fires.

### LR-A10 — Teaching has two sources of truth
- **Severity**: Medium  
- **Kind**: Verified design inconsistency  
- **Reproduction**: Doc 03 puts `taughtTopicId` on the invitation. Doc 05/06 put `knowledgeGranted` on the activity. A declined invite could still carry a taught id; a repeated activity could grant from the activity after the invite was archived.  
- **Existing system**: None; closest analogue is one-time memory ids.  
- **Mitigation**: Knowledge is granted only by `completeSharedActivity`, from the activity def. Invitation does not carry a grant. `TeachingState.known` is the only unlock flag.  
- **Required test**: Decline invite → knowledge unchanged. Complete twice → `known` length unchanged after first.

### LR-A11 — Schema version race with Build 9
- **Severity**: High  
- **Kind**: Verified process risk (called out in doc 12, under-specified in doc 07/10)  
- **Reproduction**: Doc 07 hard-codes v9 → v10. Build 9 (Copperwheel) will also need a schema bump (`PlayerLocation`, new state slice, migration), following the v7/v8/v9 pattern in `types.ts` / `migrations.ts`. Whichever lands second will ship a wrong migration if both claim v10.  
- **Existing system**: `CURRENT_SCHEMA_VERSION = 9`, chained `migrateV*` in `migrations.ts`.  
- **Mitigation**: Do not reserve “v10” in the design. Specify “current + 1” and a merge rule: the branch that merges second rebases its migration. LR-1 may land before Build 9 only if its migration is written against whatever `CURRENT_SCHEMA_VERSION` is at merge time. Add a test that fails if two migrations claim the same version.  
- **Required test**: Fixture at pre-LR version migrates once, preserves bakery/nook/greenhouse, and yields empty Living Relationships defaults.

### LR-A12 — Dialogue modularization conflict
- **Severity**: Medium  
- **Kind**: Verified process risk  
- **Reproduction**: `narrative.ts` is ~4687 lines and owns `DIALOGUE_TOPICS`. Doc 09 says new topics may be appended there “until modularization lands,” while also extending `DialogueCondition` in `dialogueEngine.ts`. Parallel modularization extracts those same topics. LR-1 and the modularization blueprint will conflict on the same lines.  
- **Existing system**: `dialogueEngine.ts` (`selectDialogueSession`, `evaluateDialogueCondition`), `narrative.ts` registry.  
- **Mitigation**: LR-1 either lands after the quest/personal extraction, or adds topics only in a new `src/game/dialogue/invitations/clara.ts` imported by a thin aggregator — never by appending to the monolith. Condition fields are additive and optional so old topics keep compiling.  
- **Required test**: Existing `dialogue.test.ts` passes unchanged; new offer topic is selected only when eligibility holds.

### LR-A13 — Mid-visit appearance and +2h / pause races
- **Severity**: Low  
- **Kind**: Hypothetical  
- **Reproduction**: Doc 04 allows the occupant to “appear on the next interior rig.update” if the player is already inside when the window opens. Simulation mutates `worldRef` every frame; discrete reducers commit via `commitWorld`. An occupancy write from the tick and a station action from the HUD in the same frame can disagree.  
- **Existing system**: `worldRef` vs throttled snapshot (`ARCHITECTURE.md`, `App.tsx` / `NeighborhoodCanvas.tsx`).  
- **Mitigation**: Occupancy changes only inside pure reducers (enter, expire helper called from time-advance and enter), never from the 60 Hz tick. Appearance is a consequence of state, not a tick side effect.  
- **Required test**: Enter just before window, advance time with +2h across start, assert occupant appears only after the reducer, once.

### LR-A14 — Clara-first is the highest-risk proving ground
- **Severity**: Medium (sequence risk)  
- **Kind**: Verified design challenge  
- **Reproduction**: LR-2 puts the first occupancy on the bakery: daily bake roster, knead-doubling, loaf share, indoor café seat, outdoor table flags, and a socially active host. Nora’s nook is a simpler cycle (featured book, tea, chair) with fewer counter interactions. A pattern-proving milestone that fails will be harder to diagnose on Clara than on Nora.  
- **Existing system**: `bakery.ts` vs `bookNook.ts` complexity.  
- **Mitigation**: Keep Clara as the first *dialogue* invite (LR-1) if desired, but prove occupancy on the nook (or keep LR-2 bakery-only after an explicit station-exclusivity contract). Alternatively accept Clara-first but add the exclusivity tests in LR-A6 as merge blockers.  
- **Required test**: Whichever interior is first gets the station-exclusivity and day-advance tests before a second host is added.

---

## WorldState Migration Risks

1. **Version collision** with Build 9 (LR-A11).  
2. **Partial defaults**: forgetting to sanitize one of `invitations` / `occupancy` / `teaching` / `activeActivity` leaves `undefined` and crashes reducers that assume objects (pattern already guarded for interior slices via `?? createInitial*`).  
3. **Unknown IDs**: an activity or knowledge id removed in a later build must be stripped, not trusted (doc 07 says this; it must be tested).  
4. **History cap**: unbounded push before cap-on-write will bloat saves if the cap is only applied in the sanitizer on load.  
5. **Occupancy + playerLocation** invariant not in the sanitizer (LR-A4).  
6. **`advanceToNextDay` clone surface**: it spreads `...state` then overrides many fields. New slices survive only if they are explicitly expired/cleared there; a blind spread keeps stale occupancy (LR-A2).

---

## Race Conditions and Conflicting Updates

| Conflict | Writers | Failure |
|----------|---------|---------|
| Complete invite | Dialogue reducer + station reducer | Double memory, double affinity (LR-A7) |
| Occupancy set | Enter reducer vs tick “soft appear” | Host pops in during an unrelated station action (LR-A13) |
| Day boundary | `advanceToNextDay` vs invite window | Stale indoor Clara, player on porch (LR-A2) |
| Bakery counters | Shared activity “mirroring” knead/share | Double `kneadingSessions` / `loavesShared` (LR-A6) |
| Affinity | Talk path + activity bonus | Cap bypass or lost bonus (LR-A8) |
| Schema | LR branch + Build 9 branch | Duplicate v10 migration (LR-A11) |
| Knowledge | Invitation field + activity field | Grant on decline or grant skipped (LR-A10) |

All of these are avoided if mutations stay in one pure function per concern and day-advance is a required caller.

---

## Clara-First Sequence — Challenge

Clara-first is justified as “prove it on a system that exists” but it is the **worst** first occupancy target:

- Densest existing ritual state (`BakeryState` day stamps and counters).  
- Shared physical station with player sit.  
- Host most likely to be in an exterior social encounter.  
- Day-advance already has bakery-specific ejection logic that the new system must join.

**Safer sequence**:

1. LR-1 dialogue + invitation state only (Clara offer is fine; no occupancy).  
2. Occupancy proof on Nora’s nook (fewer counters) **or** bakery only after LR-A6 exclusivity is specified.  
3. Teaching on the second host.  
4. Arthur only after Build 9.

The written LR-1 → LR-2 (bakery occupancy) → LR-3 order is acceptable only if LR-2’s acceptance criteria include the day-advance, exclusivity, and empty-visit tests above as blockers.

---

## Can LR-1 Begin Before Build 9?

**Yes, with conditions.**

Safe to start now:

- Pure invitation module, eligibility, accept/decline/expire.  
- One Clara dialogue offer.  
- Tests that do not require Copperwheel or a new `PlayerLocation`.

Not safe to merge blindly:

- A migration numbered v10 while Build 9 is in flight (LR-A11).  
- Any edit that assumes `PlayerLocation` will not grow.  
- Appending large topic blocks to `narrative.ts` if modularization is in progress (LR-A12).

LR-1 does not depend on Build 9. It does depend on a schema-version merge protocol and on not touching interior occupancy yet.

---

## Features to Postpone

Postpone past LR-3 (do not design them into the first reducers):

- Passive “owner is home” occupancy outside an accepted invite (doc 04 optional path).  
- Guest NPCs and player-cottage hosting.  
- Noticeboard / mailbox reminder line.  
- Direct memory writes to non-host residents.  
- Multi-day invitation windows.  
- More than one active invitation.  
- Teaching chains or repeat-lesson mastery.  
- Activities that call existing knead/water/harvest reducers instead of wrapping them.  
- Arthur / Copperwheel (correctly deferred; keep it deferred).  
- Sora music, Toby sketching, seasonal gatherings.

---

## Summary Judgment

The package correctly identifies the missing layer and the right prohibitions (no currency, no decay, no skill trees, no indoor pathfinding). It is **not implementation-ready** until the following are specified:

1. Terminal transition that clears `active`.  
2. `advanceToNextDay` as a required expiry and occupancy-clear site.  
3. A single expiry predicate over day + minute.  
4. Load invariant between occupancy and `playerLocation`.  
5. Station exclusivity with bakery (and later nook) rituals.  
6. One completion function and one knowledge source.  
7. An explicit affinity rule relative to the daily cap.  
8. Schema version as “current + 1,” not a hardcoded v10.  
9. Gossip only through the existing pipeline.

Until those are written into the design, LR-2 in particular will produce stuck invites, empty visits, or desynced Clara on the morning after a rest.
