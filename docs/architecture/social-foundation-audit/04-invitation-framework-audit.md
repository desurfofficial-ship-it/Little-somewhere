# Social Foundation — Post-Integration Adversarial Audit
# 04 — Invitation Framework and Cancellation Audit (SF-2)

**Subject:** `src/game/invitationFramework.ts` (392 lines, new in `8b715fc`) composing the unmodified chassis (`invitations.ts`, `activities.ts` — both verified byte-identical across `e3f86b8..07be49c`).
**Method:** specialist analysis (P1-B) + adversarial rounds (doc 12).

## 1. Canonical writer verification (§6.1)

The **six canonical writers** (verified by exhaustive grep of every writer of `invitations.active/history/lastOfferDayByHost`, `occupancy`, `activeActivity`):

1. `offerInvitation` (invitations.ts:209)
2. `acceptInvitation` (invitations.ts:255)
3. `declineInvitation` (invitations.ts:284)
4. `expireInvitationsAt` (invitations.ts:319)
5. `expireInvitationsInPlace` (invitations.ts:384) — the zero-GC tick writer; **omitted from the framework header's list of five** (P3 doc gap)
6. `completeSharedActivity` (activities.ts:161)

Non-canonical but sanctioned: composition wrappers `advanceClockAndReconcile` / `reconcileLivingRelationshipsOnDayAdvance` (ride writer 4) and the save/load sanitizer (runs on both save and load). **No writer outside the set exists; UI/scene/dialogue/journal/SF layers are pure readers.** The framework itself writes no invitation/occupancy/activeActivity state directly (header claim verified — its only mutations compose writers 3 and 4). The optional `forcedReason` param of `expireInvitationsAt` **pre-existed at `e3f86b8`** (with the `'host_unavailable'` toast branch and the `'day_end'` day-roll call) — SF-2's cancellation rides an existing chassis capability and added zero chassis code.

## 2. Reason-map completeness (§6.1/§6.5)

Static extraction of every reason string emitted by the chassis: **16 distinct strings**. `INVITATION_REASON_LABELS` covers 15 of 16 + 2 framework-owned keys. **Missing: `day_end`** (invitations.ts:420 — the ordinary sleep path archives leftover invitations with this reason on every day advance). Impact today: nil (`getInvitationReasonLabel` falls back gracefully; no production UI renders the map). Structural gap: test SF2-01 asserts a **hardcoded** list, so any future chassis reason (e.g. LR-3's reserved `offer_phase_closed`) lands silently un-mapped — the map is `Record<string, string>` with no compiler pin (unlike `invitations.ts`'s `TIER_ORDER`, which is type-pinned). Recommended: derive the test list from the chassis emission sites or a shared reason-union type.

## 3. Cancellation semantics (§6.2) — full case matrix

| # | Case | Behavior | Verdict |
|---|---|---|---|
| 1 | valid pending `offered` | composes `declineInvitation` → outcome `declined`, no reason, no rewards, toast | ✅ (SF2-05) |
| 2 | already-cancelled (active null) | `ok:false 'no_active_invitation'`; no state change | ✅ idempotent-by-failure |
| 3 | expired-naturally (already archived) | as #2 | ✅ |
| 4 | accepted, live | composes `expireInvitationsAt(…, 'player_cancelled')` → archives with machine reason, clears occupancy + activeActivity, spacing stamp preserved | ✅ (SF2-06) |
| 5 | activity begun (occupancy set) | same; occupant cleared; host runtime untouched | ✅ |
| 6 | player occupies location | same; no ejection; later completion refused fail-closed | ✅ |
| 7 | host unavailable between accept and cancel | cancel is player-initiated; ignores host availability | ✅ |
| 8 | missing/unknown hostId | `RESIDENTS[hostId]?.name ?? 'your host'` fallbacks | ✅ |
| 9 | invalid invitation id | N/A — no id param (single-slot model) | ✅ |
| 10 | twice in same tick | second call fails closed; no duplicate row | ✅ |
| 11 | immediately before expiration boundary | archives `player_cancelled` (forced writer) | ✅ by design |
| 12 | immediately after boundary | **also** `player_cancelled`, not natural expiry — pinned by SF2-10 | ⚠️ semantics (P3; label-only divergence, no consumer distinguishes) |
| 13 | after save/load | reason survives the sanitizer (SF2-08); post-load cancel of a still-live invite archives once | ✅ |
| 14 | another invitation targets same activity | N/A — single slot; cross-host re-offer allowed immediately | ✅ |
| 15 | never-visible invitation | N/A — offers are anchored live-at-creation | ✅ |
| 16 | **corrupted active status** (neither offered nor accepted) | falls through to the forced-expiry branch → archives `player_cancelled` with `previousStatus: undefined` | ❌ **R-02** |

## 4. Reward and relationship integrity (§6.3)

Proven, not merely pinned: `declineInvitation` and `expireInvitationsAt` write **only** `invitations`, `occupancy: null`, `activeActivity: null` — zero contact with `playerRelations`, `residents`, `npcRuntime`, `npcMemories`, `world.memories`, `worldEvents`, teaching, schedules. A full deep-snapshot scratch pin confirms it. Journal cannot change (persisted journal = `world.memories`, untouched; the derived active-invitation card disappears by design). No test asserts journal state unchanged — a pin gap, but code-path proof establishes the invariant. Rewards are reachable only through `completeSharedActivity`, which cancellation never composes. Cancellation preserves the offer-time spacing stamp (SF2-09) — documented chassis semantics applied uniformly to **every** terminal outcome, so no cancellation-specific penalty; the header's "no penalty" refers to the zero-reward guarantee (wording tension only).

## 5. Lifecycle state machine (§6.4)

`∅ → offered → accepted → terminal {completed | declined | expired}`. Every guard is code-enforced (verified by direct construction attempts, not by trusting tests): offer-while-active → `active_invitation_exists`; accept non-offered/non-live → fail-closed; decline non-offered → `cannot_decline_state`; completion mismatches → the 8 chassis refusals; expiry duality `isInvitationExpired ≡ !isInvitationLive` across tick/+2h/room-transition/day-roll/host-unavailable/load-save/cancel. **One unblocked hole:** a corrupted-status active is not a guarded state — the strict predicate collapses it to `expired`, and only the cancel path stamps player intent onto it (R-02). Reachability: **in-memory only** — the save sanitizer drops corrupted-status actives pre-JSON with zero history row, and no production writer can produce a bad status today. Severity P2 (ledger honesty), likelihood low.

## 6. Registry completeness (§6.5)

`describeInvitationCapabilities` iterates `Object.keys(SHARED_ACTIVITIES)` — adding a future host auto-appears (reusability contract verified; row count pinned dynamically by SF2-02/03). Local `tiersAtLeast` duplicates tier ranking a **third** time (`relationships.TIER_RANK`, `invitations.TIER_ORDER`, framework ORDER) — compile-time-pinned but not runtime-shared (three edit sites for one concept; P3). Registry host lookups are non-defensive (`RESIDENTS[host].name` without fallback — inconsistent with the ledger's own defensive style; P3).

## 7. Findings

- **R-02 (P2)** — corrupted-status cancel fabricates a `player_cancelled` ledger row for a state the player never saw (invitationFramework.ts:128-154; `previousStatus` guard is cosmetic — the reason stamp is unaffected). In-memory only; sanitizer drops it pre-save. Fix: fail closed for statuses ∉ {offered, accepted}.
- **R-12 (P3 batch)** — `day_end` missing from the reason map; SF2-01 hardcoded (cannot catch future reasons); header lists five canonical writers (docs 22/01 say six — the sixth is `expireInvitationsInPlace`); past-window cancel stamps intent (design-accepted, SF2-10); cap-12 eviction interplay (with history at cap, one cancel evicts the oldest completed visit — can erase a `shared_tradition` seed; doc 22 §3 accepts evidence-TTL by design, but cancellation is player-spammable — worth a design decision before LR-3 makes visit evidence richer; `thank_you_owed` is unaffected since it reads keepsake state, not history); `completeSharedActivity` re-implements the cap as literal `.slice(-12)` (pre-existing chassis, drift risk); ledger carries corrupt `outcome` values in its typed field pre-sanitize (cosmetic type lie).

## 8. Verdict (SF-2)

**A safe composition layer.** Every mutation routes through canonical writers; zero-reward holds by construction; cancellation is idempotent-or-fail-closed in every ordinary case; the persistence contract round-trips. Hazards are confined to two low-reach edges (R-02, P3 past-window semantics) and the reason-label completeness gap. Nothing blocks LR-3.
