# 05 — LR Design Decision Reconciliation (D-03, Decision A/B, D-04/H-1)

**Sources of record:** doc 14 §2.4/§4.2/§4.3 (`docs/architecture/living-relationships/14-revised-architecture.md`, on main), doc 20 §4 (anchoring), doc 21 (`21-lr1-design-decision-record.md`, recovered byte-identically from PR #3 `d615a8e` onto this branch), audit doc 16 register.

## §1 Decision A — offer-time gate + enter-time backstop: affirmed, already implemented

`canOfferInvitation` gate 4 = offer-moment honorability (`isHostAvailableForActivity`: current schedule slot within the 6 m home radius + host not in an active encounter) + window-openness; **no whole-window forecast** (doc 21 §1.4). All drift inside an otherwise live window is owned by the enter-time backstop: `enterNookAction` runs `expireInvitationsAt` then `isHostAvailableForActivity` before seating, expiring with reason `host_unavailable` and a player-visible line (actions.ts ~2973–3016). Verification on this branch: LRTL-05 pins that the tick does NOT own drift while the enter reducer visibly expires it; the adversarial specialist confirmed the backstop end-to-end (tick leaves a live invite alone with a busy host; enter archives `expired/host_unavailable`, toast contains "Nora", no occupant, no memory reward). **No code change needed.**

## §2 D-03 — ONE strict predicate (tick = save = load)

### The candidates (from the surviving LRTL-01 draft)

- **Candidate A (tolerant tick):** pre-window actives survive the tick, archived by the sanitizer. Measured consequence: the archive fires at **save** time (`serializeWorldState` = `JSON.stringify(sanitizeWorldState(state))`) with warnings discarded — a state the tick keeps, the next autosave silently destroys, and the load warning can never surface. Internally inconsistent with zero production upside.
- **Candidate B (strict tick):** the first reconciling path archives a pre-window active exactly once. **Adopted** — the draft's own instruction: "Either choice must be made explicitly and pinned in both the tick and load paths."

### Decision of record

`isInvitationExpired` is now exactly `!isInvitationLive` (doc 14 §2.4: "Anything else is expired"). One predicate across `expireInvitationsInPlace` (tick), `expireInvitationsAt` (+2h / enter / day-roll), and `sanitizeLivingRelationships` (save/load). The change is unreachable through ordinary play: production offers are anchored live-at-creation (doc 20 §4: `windowStartMinute = clamped offer minute`) and the clock only advances.

### Consistency with doc 21 Decision B

Doc 21 §2.4 adopts the **re-anchored** LR2-04b staging (option A: invite live at creation, player already inside) and records option C (tolerant predicate / pending exception) as **rejected**. Main's shipped tolerant predicate existed to keep the literal (unreachable-by-design) staging alive; unifying on strict therefore *implements* Decision B rather than contradicting it. The literal staging's invariant (no retroactive occupancy; fresh enter required) is preserved in the re-anchored test with strictly stronger reachability.

### Test consequences

- `occupancy.test.ts` LR2-04b re-staged to the doc 21 §2.5 re-anchored recipe (production paths only: offer while inside → accept → advance through the canonical window start via `advanceClockAndReconcile` + `stepSimulationInPlace` → occupancy empty at every step → exit + fresh enter while live → occupant set **and linked by invitationId**). Added assertion: anchoring makes the invite live at creation.
- `occupancy.test.ts` LR2-04b-bis (doc 21 §2.5 optional adversarial companion): hand-staged future window → first reconcile archives exactly once → spacing cooldown blocks the same-day re-offer (production-consistent forward path).
- `lr-tick-load.test.ts` LRTL-01 pins candidate B: tick archives pre-window exactly once; serialize→deserialize agrees (no divergence, no duplicate row); a raw hand-crafted save bypassing serialize still archives on load **with** the documented warning.

## §3 The 719-minute window cap (D-17): documented, kept

`computeOfferWindow` caps morning offers at 719 (`maxContiguousEnd` = the minute before Nora's distant afternoon slot) and evening offers at `max(nowMin+90, 1260)`. 719 is not the phase boundary (689) nor the canonical end (780): it is **the contiguous-home-availability boundary** — the last minute of a window that never stretches over an exterior slot. Production reachability check (adversarial specialist): morning offer at 495 → window `[495, 719]`; golden/dusk offers → `[…, 1260]`; both inclusive-ended and pinned by LRTL tests (719 inclusive-live, 720+ expired). Recorded here as the window-end policy of record; no constant change (it is load-bearing, not accidental).

## §4 D-04/H-1 — completion-time re-check: repaired (encounter signal)

The blueprint's recommendation ("add a host-availability re-check inside completeSharedActivity … ~5 lines") is implemented with one deliberate scope decision: **the completion re-check uses the encounter signal only**, not the static schedule:

- Static-schedule refusal would false-reject a normal-play-reachable state: a morning enter (window `[540, 719]`) completing after the 690 boundary with the host **visibly seated as the occupant** (occupancy freezes the host in the room; the schedule is overridden by the visit). Refusing that would contradict the on-screen state and contradict Decision A's allocation (static drift is owned by the enter backstop, which already refused 690+ entries).
- The encounter signal closes the actual integrity hole: a host pulled away mid-visit (normal play cannot produce it — the occupant skip keeps the seated host out of encounter candidacy; only a corrupted/hand-edited save can restore occupancy while an encounter claims her). The refusal is player-visible (toast naming the host), grants nothing, returns the world untouched, and leaves invite + occupancy for the window-end tick expiry or a manual exit.

Tests: H-1 refusal pins (stable refusal, zero reward leakage) + companion pin protecting post-690 completions of morning-entered visits (activities.test.ts).

## §5 Nora invitation discoverability (D-05): verified, scoring preserved

The audit's "invitation cannot surface on a fresh save" was re-measured (NR-01 + the red-test probe): the quest-postcard topic (145) gates Nora conversations until `flags.foundPostcard` — **the designed story gate**. After the gate, the post-gate ramp (two warm chats/day, production day roll) flips `canOfferInvitation` at day 4 (affinity 40 → friendly), and `inv_nora_offer_reading` (94) surfaces within **2 interactions of eligibility** (measured; ≤ 10 overall) because the tier topics it competes with drain via the same-day penalty. The invitation offer is naturally discoverable; the flagship ritual is not invisible. **No scoring change** (mandate: no arbitrary changes); NR-01 landed as the permanent guard, plus BD10-10's invitation-half mutation guard.
