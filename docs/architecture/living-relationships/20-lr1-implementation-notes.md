# 20 — LR-1 Implementation Notes

**Role**: Engineering record of the implemented LR-1 system (Invitation Foundation).
**Authority**: `14-revised-architecture.md` remains the spec of record; this document records **what was built**, not new design. It does not modify documents 14–19.
**Milestone**: Living Relationships LR-1, `WorldState v11` (`CURRENT_SCHEMA_VERSION = 11`).
**Acceptance gate**: the 24 merged LR-1 acceptance tests of `16-lr1-lr2-acceptance-test-plan.md` — **all passing through genuine production behavior** (`336/336` suite, `tsc --noEmit` clean, production build green, headless-browser QA 0 console/page errors).

---

## 1. What Was Implemented

| Subsystem | Owner file | Notes |
|---|---|---|
| Invitation lifecycle | `src/game/invitations.ts` (new) | Sole writer of `world.invitations` (doc 14 §1). `offerInvitation`, `acceptInvitation`, `declineInvitation`, `expireInvitationsAt`, `isInvitationLive`, `advanceClockAndReconcile`, `reconcileLivingRelationshipsOnDayAdvance`, atomic capped archive. |
| Occupancy writers | `src/game/occupancy.ts` (new) | `setOccupant` / `clearOccupant` / `clearAllOccupancy` (doc 14 §1/§4). `setOccupant` validates the `playerLocation` binding. |
| WorldState slices | `src/game/types.ts` | `invitations`, `occupancy`, `teaching`, `activeActivity` added to `WorldState` (doc 16 §0.1) with their record interfaces. |
| Schema migration | `src/game/migrations.ts` | `CURRENT_SCHEMA_VERSION 10 → 11`; `migrateV10ToV11` seeds the four slices empty (doc 14 §9 copy-all-then-seed policy); chain `v1→…→v11` stepwise. |
| Sanitization & load invariant | `src/game/migrations.ts` (+ slice sanitizers in the owner modules) | Doc 14 §4.3 load invariant composed in `sanitizeWorldState` after migration. |
| Day-advance integration | `src/game/storage.ts` | `advanceToNextDay` calls `reconcileLivingRelationshipsOnDayAdvance(next)` before returning (doc 14 §3 "Required"). |
| Sim-tick integration | `src/game/simulation.ts` | `stepSimulationInPlace` reconciles immediately after the minute write, only when minutes actually moved; the tick never writes occupancy (doc 19 #4). |
| +2h integration | `src/App.tsx` | `handleAdvanceTwoHours` routes through `advanceClockAndReconcile` (doc 16 §0: no manual expire from the interaction layer). |
| Save revision | `src/game/storage.ts` | `computeWorldSaveRevision` fingerprints the four LR slices. |

## 2. Public API Introduced (`src/game/invitations.ts`)

```ts
INVITATION_HISTORY_CAP = 12          // exported cap constant (doc 19 #1)
INVITATION_MIN_OFFER_SPACING_DAYS = 2 // doc 14 §2.3 gate 2
INVITATION_HOST_HOME_RADIUS = 6       // doc 14 §2.3 gate 4
INVITABLE_ACTIVITIES                  // { share_featured_reading: nook window 600–780, minTier 'friendly' }

offerInvitation(world, hostId, activityId): { ok, world, reason?, invitation? }
acceptInvitation(world): { ok, world, invitation? }
declineInvitation(world): { ok, world, reason? }
expireInvitationsAt(world, day, minute): WorldState   // in-place reconcile primitive
isInvitationLive(inv, day, minute): boolean           // sole validity predicate
advanceClockAndReconcile(world, deltaMinutes): { ok: true, world }
reconcileLivingRelationshipsOnDayAdvance(world): void
createEmptyInvitationState() / createInitialTeachingState()
sanitizeInvitationsSlice(raw, day, minute, warnings) / sanitizeActiveActivitySlice(raw, invitations)
```

`src/game/occupancy.ts`: `setOccupant(world, occupant)`, `clearOccupant(world, invitationId?)`, `clearAllOccupancy(world)`, `sanitizeOccupancySlice(raw, warnings)`.

## 3. Lifecycle & Gates

- **States (doc 14 §2.1)**: only `offered` | `accepted` occupy `active`; terminal outcomes (`completed` | `expired` | `declined`) exist only as capped history entries. Every terminal path archives exactly one entry then nulls `active` atomically (plus clearing occupancy and `activeActivity`, per §4.2/§4.3). `lastOfferDayByHost` is stamped at offer time and is **not** moved on decline/expire, so spacing keeps enforcing.
- **Offer gates (doc 14 §2.3, in order)**: single active invite → known host + known activity → 2-day spacing (inclusive boundary at exactly 2 days succeeds, LR1-09b) → tier ≥ `minTier` and not `isResidentGuarded` → schedule compatibility (the host's current phase slot within 6 m of `homePos`, computed from the existing `getResidentScheduleSlot` data) **and** the visit window still open today → no `activeEncounters` membership → weather/personality remain soft filters (no hard block in LR-1).
- **Expiry (doc 14 §2.4)**: `isInvitationLive` is conjunctive — `day <= expiresDay` AND `windowStart <= minute <= windowEnd` AND status `offered|accepted`; inclusive at both window bounds (LR1-06/07). Reconcile call sites: sim tick, +2h (via `advanceClockAndReconcile`), day advance (via the day reconcile), and the load sanitizer.
- **History cap (doc 16 LR1-23, doc 19 #1)**: bound to the exported `INVITATION_HISTORY_CAP = 12` (doc 16's documented default; the superseded doc-03 literal is not law). On write and on load: keep the newest entries, drop the oldest, never grow past the cap. No test-side or production fallback constant exists.

## 4. Window Policy (spec-derived, see doc 14 §2.3 gate 4)

The created invitation's window always **includes the offer minute**: `windowStartMinute = min(activity canonical start, max(DAY_START_MINUTE /* 360 */, floor(minuteOfDay)))` — the inner clamp is a safety floor mirroring the clock's own `clampMinuteOfDay` (so the documented formula is literally the code at `invitations.ts:263-266`), `windowEndMinute = activity.windowEndMinute` (canonical `600–780` for `share_featured_reading`), `expiresDay = offer day`. Offers whose canonical window has already passed are rejected `host_unavailable` — a window that cannot be honored must not be offered.

Rationale recorded for reviewers: doc 14 §2.4 makes `isInvitationLive` strict ("anything else is expired") and requires every minute-mutation path to run it. An offer created *before* its canonical window opens would be destroyed by the very next 60 Hz reconcile, and an offer made after the window cannot ever be honored — both violate §2.3 gate 4's "do not offer a window that [cannot be honored]". Anchoring the created window to the offer minute keeps the strict predicate, the reconcile contract, and valid player state simultaneously true. Alternative readings were rejected because they either delete valid pending state on the next tick/save-load (contradicting the sanitizer's "preserve consistent state" mandate) or require inventing a pending-state exception to the sole predicate.

## 5. Occupancy Invariants (doc 14 §4.3, composed in the sanitizer)

Load repairs, never deletes valid state:

1. Occupancy survives **only** as the consistent triple — `occupant.location === playerLocation`, an `accepted` active invite that is live at `(day, minute)`, and `occupant.invitationId === active.id`. Any other combination clears the occupant.
2. `activeActivity` survives only while a sanitized active invite exists (orphan cleared, LR1-15b).
3. A malformed occupant record, unknown resident id, or invalid location is dropped (structural sanitize in `occupancy.ts`).
4. A malformed active invite or unknown host id is cleared with a warning (LR1-16); a non-live active invite is archived `expired` (§4.3 "expire active if present").
5. Unknown resident ids are stripped everywhere (doc 15 §2.5). `teaching.known` is structurally sanitized (deduped non-empty strings) — unknown knowledge-id stripping requires the LR-4 activity registry and is deferred with it.

## 6. Persistence

- `migrateV10ToV11`: pure spread of all prior fields, then `invitations = {active: null, history: [], lastOfferDayByHost: {}}`, `occupancy = null`, `teaching = {known: []}`, `activeActivity = null`, `schemaVersion: 11`. Deterministic; no player/NPC progress touched (LR1-17/18 verify interiors, relations, memories, and day survive; older saves chain v1→…→v11 without skipped steps).
- `computeWorldSaveRevision` covers active-invite identity/window, history depth + newest entry, spacing-map size and entries, occupant ids, teaching depth, and active-activity id, so autosave change-detection sees LR-1 mutations.
- Serialization is the existing `sanitizeWorldState` path — round-trips restore live invites field-for-field (LR1-14) and repair inconsistent ones.

## 7. Verification Summary

- All 24 LR-1 acceptance tests pass through production entry points (no test calls `expireInvitationsAt` to satisfy LR1-05/LR1-19; no future schema version is hardcoded).
- Full existing suite green (336/336); `tsc --noEmit` 0 errors; production build green (pre-existing chunk warning).
- `scripts/verify_lr1.ts` (29 checks): fresh + v10-migrated save round-trips, repeated `+2h`/sim-tick/sleep transitions without double-archival, byte-identical serialization across equivalent seeded scenarios, cap/spacing on write, live-at-creation window invariant.
- Headless Chromium QA of the production build: boot, `+2h` ×3, save at v11, reload resumes persisted day/time, mobile 390×844 zero overflow — 0 console / 0 page errors. **Evidence note (added at review)**: this pass was run manually during implementation; no QA script or log is committed to the repo (`scripts/` has no `qa_lr1`). Independent review re-verified everything else in this document against the code; this one claim is trust-only and should be re-run at merge time.

## 8. Known Limitations & Remaining Roadmap (unchanged scope)

- The lifecycle is owner-API only: no dialogue topics, HUD, or UI surface yet (invitation topics stay out of `narrative.ts` per doc 14 §8; they belong to the LR-2 content pass).
- LR-2 (nook occupancy + `share_featured_reading` via `enterNookAction` + `completeSharedActivity` + station exclusivity), LR-3 (bakery), LR-4 (teaching) are intentionally **not** implemented here (doc 14 §10; doc 16 §7).
- Doc 14 §13's merge condition "LR-2 acceptance tests exist and fail before feature code" remains open — the LR-2 test package must be authored (red) before LR-2 feature code merges, per docs 14/15.
- `setOccupant` currently has no production caller (its caller, the door-enter reducer, is LR-2); it exists now because doc 14 §1 names occupancy ownership as a separate module and the sanitizer/terminal paths already exercise the clear side. `clearOccupant` is likewise caller-less in production (clears are reached via the terminal-path / sanitizer routes).
- Gate 4 scope note (added at review, **resolved 2026-11-20**): doc 14 §2.3 gate 4 can be read as checking only the host's **offer-time** phase slot against the 6 m home-radius rule (implemented: `invitations.ts` schedule gate) or as checking every schedule slot overlapping the created window. **Resolved in favor of the offer-time reading — decision record in doc 21 §1** (forecast reading rejected: dead code in doc 14 §4.2 / doc 16 LR2-03, degenerate offer availability for Nora, incompatible with the frozen gate). The enter-time `host_unavailable` backstop that doc 14 names as the safety net remains LR-2 scope and now owns ALL schedule drift (static phase crossings and encounter pulls) with the mandated LR2-03 staging recipes (doc 21 §1.6, doc 16 LR2-03 note).
- LR2-04b staging resolution (added 2026-11-20): the plan's literal precondition `minuteOfDay < windowStartMinute` is unreachable through normal invitation creation — it was inconsistent with doc 14 §2.4's strict predicate from the start, and the anchoring decision (§4) removes the state at creation. **Resolved: LR2-04b's invariant (no retroactive occupancy) is restaged as "player already inside when the invite is created" — decision record in doc 21 §2, staging note added to doc 16 LR2-04b. Assertions unchanged; not a weakening.**
