# 14 — Living Relationships Revised Architecture

**Status**: Remediation of findings in `13-adversarial-review.md`  
**Base verified**: Canonical `origin/main`, Build 8, `CURRENT_SCHEMA_VERSION = 9` (`src/game/migrations.ts`)  
**This document supersedes conflicting rules in 03–12.** Those files remain as historical design; implementers follow 14 and 15.

Verified facts are marked **Verified**. Choices made to close review findings are marked **Decision**.

---

## 1. Authoritative Ownership

| Concern | Single owner | Must not be written by |
|---------|----------------|------------------------|
| Invitation lifecycle | `expireAndArchive` / `offerInvitation` / `acceptInvitation` / `declineInvitation` in proposed `src/game/invitations.ts` | Dialogue text, scene tick, station reducers |
| Occupancy | `setOccupant` / `clearOccupant` / `clearAllOccupancy` in proposed `src/game/occupancy.ts` | 60 Hz `stepSimulationInPlace` (may only *read*) |
| Shared activity completion | `completeSharedActivity(world, activityId)` in proposed `src/game/activities.ts` | Dialogue choices, station actions (they may only *call* it) |
| Day-boundary reconciliation | `reconcileLivingRelationshipsOnDayAdvance(world)` called from `advanceToNextDay` (`src/game/storage.ts`) | HUD `+2h` path (that path calls `expireInvitationsAt` instead) |
| Knowledge grants | `completeSharedActivity` only, from the activity def | Invitation object |
| Host memory of a visit | `completeSharedActivity` only | Gossip code, other residents’ reducers |
| Affinity for a shared activity | `applySharedActivityAffinity` only | `recordPlayerTalkAffinity` |

No system may both check and mutate the same slice except the owner function.

---

## 2. Revised Invitation Lifecycle

### 2.1 States

Only **non-terminal** invitations may occupy `active`.

- `offered` — in `active`
- `accepted` — in `active`
- Terminal outcomes exist only as history entries: `completed` | `expired` | `declined`

**Decision**: There is no `status: 'completed'` left sitting in `active`. Terminal transition is atomic:

```
archive(active, outcome) → history (capped)
active = null
lastOfferDayByHost[host] = day   // already stamped at offer; not moved earlier on decline
```

`lastOfferDayByHost` is stamped when the offer is created, so decline and expire still enforce spacing.

### 2.2 State machine

```
(none)
  │ offerInvitation()
  ▼
offered ──acceptInvitation()──► accepted ──completeSharedActivity()──► (none)
   │                                │
   │ declineInvitation()            │ expireInvitationsAt()
   │ expireInvitationsAt()          │ reconcileLivingRelationshipsOnDayAdvance()
   ▼                                ▼
(none)                           (none)
         history gains one entry in every terminal path
```

### 2.3 Generation (empty-visit prevention)

`offerInvitation` may run only when all of the following hold (**Decision**):

1. `active === null`
2. Host spacing: `day - (lastOfferDayByHost[host] ?? -99) >= minDays` (default 2)
3. Tier ≥ activity `minTier`; host not guarded (`isResidentGuarded`)
4. **Schedule compatibility**: host’s schedule slot for the offer’s phase has `placeName` or target within home radius (proposed 6 m of `homePos` in `residents.ts`), or the slot is already a known home/porch node. Do not offer a window that overlaps a distant slot (gazebo, pond, orchard).
5. No active exterior encounter for that host (`activeEncounters` in `simulation.ts` / `WorldState`)
6. Weather/personality gates as soft filters only

If a previously accepted invite becomes incompatible at enter time (host pulled into an encounter after accept), enter does **not** silently no-op. It calls `expireInvitationsAt` with reason `host_unavailable` and returns a player-visible line. That is the empty-visit prevention rule.

> **Decision record (doc 21 §1, 2026-11-20 — pre-merge, PR #3):** gate 4's second sentence constrains the **offer moment** — the host's current slot must sit within the home radius and the window must still be open today. It does **not** require forecasting every future schedule slot inside the created window. A forecast reading is rejected because (a) it makes §4.2's enter-time schedule re-check and doc 16 LR2-03's schedule branch dead provisions, (b) with the real schedule data it makes `share_featured_reading` un-offerable for its only host (Nora's canonical window 600–780 always overlaps her distant afternoon slot 690–780), and (c) it is incompatible with the frozen 24-test acceptance gate. Schedule drift inside a live window — static phase crossings and dynamic encounter pulls alike — is owned by the enter-time `host_unavailable` backstop with a player-visible line (§2.3 above, §4.2, §10; doc 16 LR2-03).

### 2.4 Expiry precedence

**Decision — single predicate** `isInvitationLive(inv, day, minute)`:

```
inv is live iff
  active is inv
  AND day <= inv.expiresDay
  AND minute >= inv.windowStartMinute
  AND minute <= inv.windowEndMinute
  AND (status is offered or accepted)
```

Anything else is expired. `expiresDay` and the minute window are conjunctive, not alternative. The game has no midnight crossing inside a day (`minuteOfDay` 360–1290, `NEXT_DAY_WAKE_MINUTE = 480` in `time.ts`); multi-day windows are postponed.

Call sites that must run the predicate:

- `advanceToNextDay` (via reconcile)
- `+2h` / any minute mutation reducer
- Door enter reducer for the invite’s location
- Dialogue selection (read-only)

---

## 3. Day-Transition Reconciliation Contract

**Verified**: `advanceToNextDay` (`storage.ts` ~422) already:

- Sets `day + 1`, `minuteOfDay = NEXT_DAY_WAKE_MINUTE` (480)
- Resets `talkedToday`, `dailyAffinityGained`
- Ejects the player from greenhouse, bakery, and nook onto the porch (`wokeInsideBakery`, `wokeInsideNook`)
- Replaces `npcRuntime` with `createInitialNpcRuntime(...)`
- Clears `activeEncounters`
- Leaves `bakeryState` / `nookState` as previous-day stamps (intentional)

**Decision**: Before the return, `advanceToNextDay` calls `reconcileLivingRelationshipsOnDayAdvance(state, nextDay)` which:

1. If `active` is non-null, archive it as `expired` (a new day always ends a v1 invite; no overnight invites).
2. `clearAllOccupancy()`.
3. `activeActivity = null`.
4. Does not touch `teaching.known` or history except for the archive append.

Because `npcRuntime` is fully reset, no occupant position needs to be restored. Clearing occupancy is what stops the next frame from skipping that resident.

**Required**: This call is part of the function, not a follow-up tick. A test that only calls `advanceToNextDay` must observe the clear.

---

## 4. Revised Occupancy Model

### 4.1 Shape

```ts
interface InteriorOccupant {
  residentId: ResidentId;
  location: PlayerLocation;   // must equal world.playerLocation while set
  stationId: string;
  localPos: Vec2;
  facing: number;
  invitationId: string;       // the accepted invite that justified presence
}
```

**Decision**: Occupancy exists only while an accepted invite is live **and** the player is inside that invite’s location. There is no passive “owner is home” occupancy in v1.

### 4.2 Who writes it

- **Set**: door-enter reducer, after `isInvitationLive` and schedule/encounter re-check pass, via `setOccupant`.
- **Clear**: door-exit reducer, `expireInvitationsAt`, `completeSharedActivity`, `reconcileLivingRelationshipsOnDayAdvance`, load sanitizer.

`stepSimulationInPlace` only reads occupancy to skip exterior pathing/encounters for that resident. It does not create or move occupants.

### 4.3 Save/load reconciliation

**Decision — load invariant** (in sanitizer, after migration):

```
if occupancy.location !== world.playerLocation → clear occupancy
if occupancy.invitationId !== active?.id → clear occupancy
if active is null or not live at (day, minute) → clear occupancy and expire active if present
if activeActivity is set but active is null → clear activeActivity
```

Rationale: `playerLocation` and door stash (`exteriorPlayerPos`) are already the source of truth for where the player is (`actions.ts` enter/exit blocks). Occupancy must not outlive that.

Reload mid-visit restores the host only when the player is still inside, the invite is still live, and ids match. Otherwise both are cleared. No half state.

---

## 5. Shared Activity Transaction Contract

### 5.1 Single function

`completeSharedActivity(world, activityId): { world, ok, reason }`

Atomic sequence, all or nothing:

1. Reject if `activeActivity?.activityId !== activityId` and no matching accepted live invite (start and complete may be the same call for short rituals).
2. Reject if memory id already in `world.memories`.
3. Reject if station exclusivity fails (see §6).
4. Apply activity-local flavor only. **Do not call** `knead` / `loaf share` / `harvest` / `browse` reducers.
5. Append one journal memory (existing id-guard pattern in `actions.ts`).
6. Append one host NPC memory via existing memory helpers. No other resident.
7. Call `applySharedActivityAffinity` once.
8. Grant `knowledgeGranted` if absent.
9. Archive invite as `completed`, `active = null`.
10. `clearOccupant` for that location.
11. Push one world event for the existing gossip pipeline.

Second call with the same memory id returns `ok: false` and the same world.

Dialogue choices and station buttons both call this function. They do not duplicate its writes.

### 5.2 Affinity rule

**Verified**: `recordPlayerTalkAffinity` applies `DAILY_SMALLTALK_AFFINITY_CAP` (20) to ordinary talk, and bypasses it for gifts and story milestones (`relationships.ts`).

**Decision**:

- Offer/accept/decline dialogue passes `requestedTrustDelta: 0` so it does not consume or add smalltalk affinity.
- `applySharedActivityAffinity` adds a fixed `+6` affinity and `+2` reliability, once per `activityId` per invite, and does **not** increment `dailyAffinityGained`. It is not a milestone and not a gift. Cap: the +6 cannot push affinity above 100; it cannot fire twice for the same archived invite id.

This preserves the cozy non-grind cap on chatter while making the shared moment feel distinct.

---

## 6. Station Exclusivity

### 6.1 Rule

While `activeActivity` is set or an accepted invite is live and the player is at that station:

- The linked station’s ordinary primary action is suppressed or returns “Clara/Nora is sharing this with you.”
- Player sit on that seat is rejected until the activity completes or the invite expires.
- The shared activity does not mutate `kneadedDay`, `loafSharedDay`, `shelfBrowsedDay`, `teaSharedDay`, `booksRead`, or greenhouse plot fields.

### 6.2 Why the nook is the first occupancy proving ground

**Verified comparison**:

| | Bakery (`bakery.ts`, `actions.ts` ~2400+) | Book Nook (`bookNook.ts`, `actions.ts` ~2695+) |
|--|--------------------------------------------|------------------------------------------------|
| Day-stamped counters | `bakeCheckedDay`, `kneadedDay`, `loafSharedDay`, `kneadingSessions`, `loavesShared` | `shelfBrowsedDay`, `teaSharedDay`, `notesReadDay`, `booksRead`, `teasShared` |
| Cross-action coupling | Knead doubles same-day share count | Browse and tea are independent; booksRead caps at 4 |
| Seat | Café chair sit overlaps table ritual | Armchair sit is a single settle |
| Host schedule pressure | Clara high sociability (0.72), often in square/encounters | Nora lower outdoor pull |
| Day-advance ejection | Yes (`wokeInsideBakery`) | Yes (`wokeInsideNook`) |

**Decision**: First occupancy milestone uses the Linden Book Nook (`share_featured_reading` at `nook_chair`). Bakery shared pastry is the second occupancy milestone, after exclusivity tests exist. Clara may still be the first *dialogue offer* if desired, but she is not the first interior occupant.

This does not weaken bakery behavior. Existing knead/share remain unchanged and are simply not called by the new activity.

---

## 7. Memory and Relationship Ownership

- **Journal**: one memory id per activity def, written only in `completeSharedActivity`, guarded by `memories.some(id)`.
- **NPC memory**: host only, provenance `shared_activity`, written in the same function. Retention follows existing caps in `memories.ts` (`MAX_NPC_MEMORIES_PER_RESIDENT`).
- **Gossip**: other residents learn only if existing gossip selection (`memories.ts` hop/affinity/tension gates) picks up the world event. No direct write to a “nearby friend.”
- **Teaching**: `TeachingState.known` appended only if `knowledgeGranted` is set and absent. Invitation carries no `taughtTopicId`. Repeat activity after knowledge exists still allows the cozy moment but the affinity helper no-ops if that invite id was already archived (it will have been). A later uninvited repeat is postponed.
- **Decline/expire**: no affinity change, no memory, no knowledge.

---

## 8. Dialogue Modularization Compatibility

**Decision**:

- New topics live in `src/game/dialogue/invitations/` (one file per host) and are concatenated by an aggregator.
- Do not append invitation topics to the `DIALOGUE_TOPICS` literal in `narrative.ts`.
- New `DialogueCondition` fields are optional. `evaluateDialogueCondition` in `dialogueEngine.ts` treats absence as pass.
- Offer topic is available only when `offerInvitation` would succeed (read-only eligibility check shared with the writer).

This stays compatible with the modularization blueprint and avoids merge conflicts on the 4.6k-line registry.

---

## 9. Migration Coordination Strategy

**Verified**: Latest canonical schema is **9**. Chain ends at `migrateV8ToV9`. Build 9 (Copperwheel) is not in this tree and will need its own bump when it lands.

**Decision — do not prescribe v10.**

Policy:

1. At implementation start, read `CURRENT_SCHEMA_VERSION`.
2. The Living Relationships migration is `migrateV{N}ToV{N+1}` where `N` is the version at the moment the branch is cut, rebased to whatever is current at merge.
3. If Build 9 merges first and becomes v10, Living Relationships becomes v11 (or whatever is next). Numbers in this doc are illustrative only.
4. Migration body is always: copy all prior slices unchanged, then set  
   `invitations = empty`, `occupancy = empty`, `teaching = empty`, `activeActivity = null`.
5. Sanitizer always runs the load invariant in §4.3.
6. A unit test fails if two migration functions claim the same target version.
7. Parallel branches rebase; they do not both commit a migration with the same version number.

`PlayerLocation` is not extended by Living Relationships. Copperwheel’s new location value remains Build 9’s responsibility.

---

## 10. Revised Milestone Dependency Map

```
Build 8 (schema 9, verified)
    │
    ├─ Dialogue modularization (parallel, recommended before invitation topics land)
    ├─ Build 9 Copperwheel (parallel; owns next schema if it merges first)
    │
    ▼
LR-1  Invitation foundation (no occupancy)
      Host offer may be Clara or Nora; state machine + day-advance expire only
    │
    ▼
LR-2  Nook occupancy + share_featured_reading   ◄── first proving ground
      Exclusivity vs browse/tea; day-advance clear; load invariant
    │
    ▼
LR-3  Bakery occupancy + share_morning_pastry
      Exclusivity vs knead/share; Clara schedule gate
    │
    ▼
LR-4  Teaching flag on the nook or bakery activity (one knowledge id)
    │
    ▼
LR-5  Arthur / Copperwheel only after Build 9 has merged
```

### Milestone acceptance additions (blockers from review)

Every milestone that touches persistence must:

- Call or be called by `advanceToNextDay` and assert clear/expire
- Round-trip a save and assert the load invariant
- Use the schema policy in §9, not a hardcoded version

LR-2 is not done until: enter during live invite shows Nora; enter when she is in a distant slot expires with a line; browse/tea counters unchanged by the shared read; rest-until-morning clears occupancy.

---

## 11. Findings Disposition

| ID | Finding | Disposition in this doc |
|----|---------|-------------------------|
| LR-A1 | Active slot not cleared | §2 atomic archive |
| LR-A2 | Day advance ignores systems | §3 reconcile contract |
| LR-A3 | Window vs expiresDay | §2.4 single predicate |
| LR-A4 | Load desync | §4.3 load invariant |
| LR-A5 | Silent empty visit | §2.3 generate gate + enter expire |
| LR-A6 | Bakery station clash | §5.1 no reducer mirroring; §6 exclusivity; nook first |
| LR-A7 | Double completion | §5.1 single function + memory id guard |
| LR-A8 | Affinity cap | §5.2 explicit +6 outside smalltalk, offer grants 0 |
| LR-A9 | Gossip leak | §7 host-only + existing pipeline |
| LR-A10 | Dual teaching source | §7 activity def only |
| LR-A11 | Schema race | §9 current+1 policy; verified schema is 9 |
| LR-A12 | narrative.ts conflict | §8 separate invitation modules |
| LR-A13 | Tick vs reducer | §4.2 occupancy only in reducers |
| LR-A14 | Clara-first risk | §6.2 / §10 nook is first occupancy |

No critical finding is left unresolved in this revision. Implementation must follow these contracts; the older docs do not override them.

---

## 12. Explicitly Still Postponed

- Passive owner occupancy without an invite
- Guest NPCs and player-cottage hosting
- Multi-day invite windows
- More than one active invite
- Noticeboard/mailbox reminder
- Direct non-host memory writes
- Activities that call knead, share, harvest, or browse reducers
- Arthur until Build 9 has merged
- Teaching chains

---

## 13. Readiness Decision

**READY WITH EXPLICIT CONDITIONS.**

Evidence:

- Critical paths now have a single owner and a defined call site (`advanceToNextDay`, enter reducer, `completeSharedActivity`).
- Schema policy matches the verified chain (v9) and does not collide with an unmerged Build 9 by assuming v10.
- First occupancy target is the simpler nook, with bakery exclusivity deferred until the pattern is proven.
- Cozy constraints (no decay, no currency, no skill tree, offer grants no affinity, miss has no penalty) are intact.

Conditions that must be true before code is written (see document 15):

1. Implementers treat document 14 as authoritative over 03–12.
2. Schema version is read from `CURRENT_SCHEMA_VERSION` at branch cut and rebase, never hardcoded from this doc.
3. LR-2 acceptance tests for day-advance, load invariant, and station exclusivity are written before feature code merges.
4. Invitation topics are not added to the `narrative.ts` monolith.
5. No occupancy write exists outside the named owner functions.
