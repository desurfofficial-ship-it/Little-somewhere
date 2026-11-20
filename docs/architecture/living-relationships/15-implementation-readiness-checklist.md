# 15 — Implementation Readiness Checklist

**Authority**: `14-revised-architecture.md` overrides 03–12 where they differ.  
**Verified base**: `CURRENT_SCHEMA_VERSION = 9` in `src/game/migrations.ts`. Build 9 is not in this tree.  
**Decision**: READY WITH EXPLICIT CONDITIONS.

Do not start implementation until every gate in §1 is checked. Do not merge a milestone until its §3 tests exist and pass.

---

## 1. Pre-Implementation Gates

- [ ] Implementers have read document 14 and the disposition table (§11).
- [ ] `CURRENT_SCHEMA_VERSION` re-read on the branch that will be cut. Migration target is that value + 1 after rebase, not “v10” from an older doc.
- [ ] Confirmed Build 9 has not merged a migration with the same target version. If it has, rebase.
- [ ] Invitation topic files will live under `src/game/dialogue/invitations/`, not inside the `DIALOGUE_TOPICS` literal in `narrative.ts`.
- [ ] First occupancy proving ground is the Linden Book Nook, not the bakery (document 14 §6.2, §10).
- [ ] No passive “owner is home” occupancy, no guest NPCs, no non-host memory writes in the first three milestones.

---

## 2. Authoritative Contracts (must be implemented as specified)

### 2.1 Invitation

- [ ] `active` holds only `offered` or `accepted`.
- [ ] `offerInvitation`, `acceptInvitation`, `declineInvitation`, `expireInvitationsAt` are the only writers.
- [ ] Every terminal path archives then sets `active = null` in the same reducer.
- [ ] `isInvitationLive` is the only validity predicate (day ≤ expiresDay AND minute inside window).
- [ ] Offer refused if host schedule slot is outside home radius or host is in `activeEncounters`.
- [ ] Enter while accepted but host unavailable expires with a player-visible line (no silent empty room).

### 2.2 Day advance

- [ ] `advanceToNextDay` (`src/game/storage.ts`) calls `reconcileLivingRelationshipsOnDayAdvance` before return.
- [ ] That helper archives any active invite as expired, clears occupancy, nulls `activeActivity`.
- [ ] It does not depend on a subsequent simulation frame.
- [ ] Existing ejection of the player from bakery/nook/greenhouse is unchanged.

### 2.3 Occupancy

- [ ] Set only in the door-enter reducer via `setOccupant`.
- [ ] Clear on exit, expire, complete, day advance, and load sanitizer.
- [ ] `stepSimulationInPlace` only reads occupancy to skip that resident’s exterior steering.
- [ ] Occupancy implies `playerLocation === occupant.location` and `active.id === occupant.invitationId`.

### 2.4 Completion

- [ ] `completeSharedActivity` is the only function that writes the visit memory, host NPC memory, activity affinity, knowledge grant, invite archive, and occupancy clear.
- [ ] It does not call knead, loaf-share, browse, tea-pour, or harvest reducers.
- [ ] Second call with the same memory id is a no-op (`ok: false`).
- [ ] Offer/accept dialogue uses `requestedTrustDelta: 0`.
- [ ] Activity affinity is +6 / +2 reliability, once, and does not increment `dailyAffinityGained`.

### 2.5 Load

- [ ] Sanitizer enforces the §4.3 invariant in document 14.
- [ ] Unknown activity, knowledge, or resident ids are stripped.
- [ ] History length is capped on write, not only on load.

---

## 3. Milestone Acceptance Tests

### LR-1 — Invitation foundation

- [ ] Offer / accept / decline / expire each leave `active === null` after terminal outcomes (expire and decline do; accept does not until complete or expire).
- [ ] Second offer blocked while one is active.
- [ ] Decline and expire do not change affinity.
- [ ] `advanceToNextDay` expires an accepted invite and clears occupancy placeholders.
- [ ] `+2h` across `windowEndMinute` expires the invite.
- [ ] Migration from current schema preserves bakery, nook, and greenhouse state and yields empty Living Relationships slices.
- [ ] Existing `dialogue.test.ts` still passes.

### LR-2 — Nook proving ground

- [ ] Enter during a live Nora invite places her at `nook_chair` (or declared station).
- [ ] Enter when her schedule target is distant expires with a visible line and does not set occupancy.
- [ ] `completeSharedActivity` does not change `shelfBrowsedDay`, `teaSharedDay`, or `booksRead`.
- [ ] Sit on the armchair is rejected while the activity or live invite holds the station.
- [ ] Rest until morning (`advanceToNextDay`) leaves player on nook porch (existing behavior), occupancy empty, invite archived.
- [ ] Save/load inside a live visit restores occupant; save/load outside or after window clears both.
- [ ] Only Nora receives the NPC memory; a low-affinity neighbor does not.

### LR-3 — Bakery (after LR-2)

- [ ] Same occupancy, day-advance, and load tests as LR-2.
- [ ] `completeSharedActivity` does not change `kneadedDay`, `loafSharedDay`, `kneadingSessions`, or `loavesShared`.
- [ ] Same-day knead still doubles share exactly as it does today when the shared activity is not used.
- [ ] Clara offer is suppressed when her phase slot is away from home.

### LR-4 — Teaching

- [ ] Knowledge id appended once.
- [ ] Decline does not grant knowledge.
- [ ] Dialogue condition sees `teaching.known` and does not see a field on the invitation.

---

## 4. Regression Net

- [ ] Full existing test suite green (206 at Build 8 baseline, plus new files).
- [ ] `tsc --noEmit` clean.
- [ ] Production build succeeds (pre-existing chunk warning acceptable).
- [ ] No change to outdoor encounter pairing for residents who are not the current occupant.
- [ ] No new currency, decay, cooldown penalty, or skill-tree UI.

---

## 5. Conditions Still Binding

The architecture is implementable only if:

1. Document 14 is the spec of record.
2. Schema version is coordinated at merge time against the real `CURRENT_SCHEMA_VERSION`.
3. LR-2 tests in §3 are written and failing before feature code, then passing before merge.
4. Topics stay out of `narrative.ts`.
5. Occupancy and completion have exactly the owners named in document 14 §1.

If any condition is dropped, status reverts to **NOT READY**.

---

## 6. Decision

**READY WITH EXPLICIT CONDITIONS.**

Justification:

- Document 13’s critical findings (day advance, active-slot cleanup, empty visits, bakery exclusivity, schema collision) each have a single owner and a test in this checklist.
- Canonical schema was verified as 9; the revision does not claim v10.
- Nook-first occupancy avoids the knead/share coupling in `actions.ts` until the pattern is proven.
- Existing cozy rules are preserved: missing an invite has no penalty, chatter cap is untouched, teaching is a flag not a tree.

Implementation may begin at LR-1 when §1 is complete. LR-2 must not merge on tests alone from the older package; it must satisfy §3 LR-2.
