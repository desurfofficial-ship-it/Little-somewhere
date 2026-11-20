# 21 — LR-1 Design Decision Record: Gate-4 Eligibility Scope & LR2-04b Staging

**Status**: Decision of record, made before PR #3 merge approval. Binding for LR-2 acceptance-test authoring (doc 16) and LR-2 implementation (doc 14 §13 red-test-first rule).
**Scope**: Resolves the two carried-forward review concerns from the independent LR-1 review (doc 20 §8). **No gameplay code changes; no acceptance-test changes.** All resolutions are consistent with the implementation as merged on `feat/lr1-implementation` (commits `53260de`, `ce84755`, `ca7ee7d`).

---

## 1. Issue A — Doc 14 §2.3 gate 4: offer-time vs whole-window eligibility

### 1.1 The exact conflict

Doc 14 §2.3 gate 4 contains two sentences with different scopes:

1. *"host's schedule slot for the offer's phase has placeName or target within home radius (proposed 6 m of homePos in residents.ts), or the slot is already a known home/porch node."* — an **offer-moment** check.
2. *"Do not offer a window that overlaps a distant slot (gazebo, pond, orchard)."* — readable as a **whole-window forecast**: no schedule slot falling inside the created window `[windowStart, windowEnd]` may place the host farther than the home radius.

The implementation (doc 20 §3; `src/game/invitations.ts` gate 4) implements sentence 1 plus a window-openness check (`minuteOfDay > activity.windowEndMinute` → `host_unavailable`). It does **not** forecast future slots inside the window.

Concretely, with the production schedule data (`src/game/residents.ts`) and the canonical `share_featured_reading` window 600–780 (`src/game/invitations.ts`): Nora is at her homePos through the morning phase (360–689), at West Bench — ≈7.56 m from `homePos`, outside the 6 m radius — through the afternoon phase (690–959), and back near home for golden/dusk. `createDefaultWorldState()` starts at minute 495 (morning). Therefore **every normally offered invite is created with window `[495–600 … 780]`, whose final 90 minutes (690–780) overlap Nora's distant West Bench slot**. An offer at 10:00 AM can produce a visit window that is host-honored until 11:30 AM and host-empty from 11:30 AM to 1:00 PM.

### 1.2 The intended gameplay behavior

Tracing doc 14's own acceptance architecture settles the intent:

- **LR-A5 disposition (doc 14 §11)**: *"§2.3 generate gate + enter expire"* — a deliberate **two-layer** defense.
- **Doc 14 §4.2**: the door-enter reducer sets occupancy *"after `isInvitationLive` and **schedule/encounter re-check** pass"*. The enter path is specified to re-run the schedule check.
- **Doc 14 §10**: LR-2 is not done until *"enter when she is in a distant slot expires with a line."*
- **Doc 16 LR2-03** precondition: *"Accepted invite, but Nora's runtime/schedule is distant or she is in activeEncounters"* → enter must archive `expired` with reason `host_unavailable` and a player-visible line.

Under a whole-window forecast reading, the schedule half of §4.2's enter re-check could **never** fail (a forecast-clean window guarantees the host is home for its entire span), and the schedule branch of LR2-03's precondition would be unreachable — both become dead provisions. Under the offer-time reading, every provision is live: the generate gate rejects offers that are not honorable *now*; the enter re-check owns **all drift after accept** — the static schedule crossing at minute 690 as well as dynamic encounter pulls — and expires visibly with `host_unavailable`.

### 1.3 Options evaluated

| Option | Description | Assessment |
|---|---|---|
| **A. Offer-time reading (implemented)** | Gate 4 = current-slot radius check + window-open check; enter-time `host_unavailable` backstop owns all drift (doc 14 §2.3 last paragraph, §4.2, §10; doc 16 LR2-03). | All doc 14/16 provisions stay live; matches the frozen acceptance gate; zero LR-1 player impact (no enter reducer exists yet). |
| **B. Whole-window forecast gate** | Reject any offer whose window overlaps any future distant slot. | **Incompatible with the frozen acceptance gate**: every successful offer in the 24 merged gate tests is made at minute 495 with real schedule data, so a forecast gate rejects every successful-offer fixture and turns the suite red. **Also degenerate gameplay**: Nora's canonical window 600–780 necessarily overlaps her distant afternoon phase 690–780, so under a forecast gate `share_featured_reading` could never be offered to Nora at all — contradicting doc 14 §6.2, which makes the nook shared reading the flagship LR-1/LR-2 activity. |
| **C. Window truncation** | On offer, clip `windowEndMinute` to the start of the first future distant slot (morning offer → window ends at 690). | Invents semantics defined in no doc; changes the canonical window that doc 16 LR1-06/07 and the LR-2 fixtures fix at 780; stacks a second invented policy on the anchoring decision; larger LR-2 churn for marginal gain. Rejected. |
| **D. Offer-time gate + shorter canonical window** | Move the canonical window fully inside one phase (e.g. 480–689). | Changes doc 14 §6.2 / doc 16 canonical values (spec-of-record and frozen boundary tests reference 600–780); a content/balance decision outside this review's mandate. Not adopted; may be raised as future design input. |

### 1.4 Decision

**Option A is adopted.** Gate 4 sentence 2 is interpreted as the offer-moment honorability constraint (host's current slot within the home radius **and** the window still open today); it does not require a forecast over future schedule slots inside the window. Schedule drift inside a live window — static phase crossings and dynamic encounter pulls alike — is owned by the enter-time `host_unavailable` backstop (doc 14 §2.3 last paragraph, §4.2, §10; doc 16 LR2-03), which expires the invite **with a player-visible line** rather than silently producing an empty room. The implemented gate and the created-window anchoring (doc 20 §4) are correct as-built; **no LR-1 code changes**.

### 1.5 Why this is the architecture-compatible choice

1. It is the only reading under which doc 14 §4.2's schedule re-check and doc 16 LR2-03's schedule branch remain reachable, testable provisions rather than dead code.
2. It preserves the frozen 24-test acceptance gate byte-for-byte (forecast/truncation readings would flip multiple green tests red).
3. It avoids the degenerate outcome where the flagship activity is un-offerable for its only LR-1/LR-2 host.
4. Player-facing behavior degrades gracefully: a visit attempted during drift produces an explicit, visible expiry — exactly the experience doc 14 §10 mandates — instead of either a silent empty room or no invitation being possible in the first place.

### 1.6 Required regression tests (authored in LR-2, red before LR-2 feature code per doc 14 §13)

- **LR2-03 static path**: offer in the morning phase (fresh world, minute 495) → advance the clock past 690 via a production path (`advanceClockAndReconcile` or `stepSimulationInPlace`) → `enterNookAction` → invite archived `expired`, reason `host_unavailable`, player-visible line, no occupant, no memory/affinity change.
- **LR2-03 dynamic path**: accept an invite, pull the host into `activeEncounters`, enter → same observable outcome.
- No new LR-1 tests; the existing gate plus `scripts/verify_lr1.ts` ("offer before the canonical window start succeeds") already pin the offer-time reading executably.

---

## 2. Issue B — Why the anchoring decision makes LR2-04b's precondition unreachable

### 2.1 The exact conflict

Doc 16 LR2-04b (added by doc 18 as the mitigation for doc 17 audit risk 5; blessed by doc 19) stages: *"Player already in `nook_interior` via `enterNookAction` **before the window**. Invite exists but `minuteOfDay < windowStartMinute`. No occupant"* — then advances time into the window and asserts **no retroactive occupancy** (occupant appears only after exit + a fresh `enterNookAction`).

That precondition is unreachable through normal invitation creation, for three stacked reasons traceable through the docs:

1. **Doc 14 §2.4 never defined a pending phase.** The single predicate says *"Anything else is expired"* — an invite with `minuteOfDay < windowStartMinute` is not live — and §2.4 requires **every** minute-mutation path to run it. A pre-window invite would therefore be archived `expired` at the first reconcile after creation, even before the anchoring decision existed. Doc 16 LR2-04b was authored against an implicit pending-invite model that doc 14 §2.4 already forbade.
2. **The anchoring decision (doc 20 §4) removes the state at creation.** `windowStartMinute = min(canonical start, max(DAY_START_MINUTE, floor(minuteOfDay)))` guarantees `windowStartMinute ≤ offerMinute`, so every created invite is live at creation — the only doc-14-consistent way an offer can survive its next reconcile. After creation the clock only advances, so `minuteOfDay < windowStartMinute` can never hold for a normally offered invite.
3. **Persistence cannot represent the state either.** The load sanitizer archives a non-live active invite as `expired` (LR1-16 path), so a hand-edited save carrying a pre-window invite is expired on load. The state exists only as a transient in-memory construction, and even then survives only if the first predicate-checking reconcile happens at a minute already inside the window (a single clock jump landing past `windowStartMinute`).

### 2.2 The intended gameplay behavior

The invariant LR2-04b protects is **not** affected: doc 14 §4.2 — occupancy is set **only** by the door-enter reducer (after the live + schedule/encounter re-check), and `stepSimulationInPlace` never creates or moves occupants. Time passing while the player is already inside must never spawn the host retroactively; placement requires a fresh enter. Doc 17 risk 5 called this out as an invariant test, "not a new feature". The anchoring decision changes *when an invite can first be live* (at creation), not *who may place an occupant* (only a fresh enter). So the intended gameplay is fully preserved; only the test's staging recipe is stale.

### 2.3 Options evaluated

| Option | Description | Assessment |
|---|---|---|
| **A. Re-anchor the staging (recommended)** | Author LR2-04b as *"player already inside `nook_interior` when the invite is created"*: offer at minute 495 while the player is inside (anchored window `[495, 780]`, live at creation), advance time inside the window, assert no retroactive occupant; exit + re-enter while live → occupant set. | Fully production-reachable through `offerInvitation` + a production clock path; tests the identical invariant with the identical Pass/Fail criteria ("Occupancy still empty… After exit and a new `enterNookAction` while the invite is live, occupant is set"). |
| **B. Adversarial staged variant (optional companion)** | Hand-stage `windowStartMinute` in the future and jump the clock past it in one step; assert no retroactive occupant (and, for tick-based paths, that the pre-window reconcile expires the invite first). | Guards the reducer against corrupted/hand-edited state; coherent only with jump paths (a tick path expires the invite pre-window per §2.4). Useful but fragile; record as optional, not required. |
| **C. Reverse the anchoring (canonical start, pending exception)** | Restore canonical `windowStartMinute = 600` and exempt pending invites from the predicate. | Rejected in doc 20 §4 with recorded rationale (destroys valid pending state on the next tick; invents a pending-state exception to the sole predicate); would contradict the decision recorded in doc 20 §4, WORKLOG Entry 046, and HANDOVER §15; would break `verify_lr1.ts` live-at-creation pins. Rejected. |

### 2.4 Decision

**Option A is adopted**: LR2-04b's precondition must be staged as *"already inside when the invite is created (live at creation under the anchoring policy)"*. Option B may be added as an optional adversarial companion. Option C stays rejected. The invariant, actions, and expected outcomes of LR2-04b are unchanged — **this is a staging correction, not a weakening**: the assertion (no retroactive occupancy; fresh enter required) keeps its full force and becomes stronger by exercising a state production actually reaches.

### 2.5 Required regression tests (authored in LR-2, red before LR-2 feature code)

- **LR2-04b (re-anchored, required)**: player inside `nook_interior`; `offerInvitation` at minute 495; advance into/through the window via `advanceClockAndReconcile` or `stepSimulationInPlace` without exiting → occupancy stays empty at every step; after exit + fresh `enterNookAction` while live → occupant set and linked to the live invite.
- **LR2-04b-bis (staged adversarial, optional)**: in-memory fixture with future `windowStartMinute`, single clock jump into the window → no retroactive occupant; fresh enter while live → occupant set.
- No LR-1 test changes; the 24-test gate is untouched.

---

## 3. Modification summary

| Surface | Change | Why |
|---|---|---|
| Gameplay code | **None** | Both issues resolve with the implementation as-built |
| Acceptance tests | **None** (24-test gate untouched) | Resolutions are compatible with the frozen gate; the required tests are LR-2 red tests, authored later per doc 14 §13 |
| Doc 14 §2.3 | Clarifying decision note appended (this document is authoritative for sentence 2's scope) | Prevents re-litigation at the spec-of-record level |
| Doc 16 LR2-03 / LR2-04b | Additive staging notes | LR-2 test authors stage through reachable production paths |
| Doc 20 §8 | Gate-4 bullet marked resolved (pointer here) | Limitation list stays truthful |
| HANDOVER / WORKLOG | Pointer + Entry 047 | Handover accuracy and worklog continuity |

## 4. Verification of preserved invariants

- Single-predicate expiry, inclusive window bounds, and reconcile call sites: unchanged (doc 20 §3).
- Created-window anchoring and its recorded rationale: unchanged and now load-bearing for LR2-04b's re-anchored staging (doc 20 §4).
- Two-layer empty-visit defense (generate gate + enter expire): unchanged in structure; layer responsibilities now explicit (§1.4 above).
- No LR-2 code or tests exist; doc 14 §13's red-test-first merge condition remains open and now carries the mandated staging recipes from §1.6 and §2.5.
