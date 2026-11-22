# 02 — Design Decision Register

Conventions follow `docs/architecture/living-relationships/21-lr1-design-decision-record.md` (evidence → options → decision → consequences → test → status). Decisions SF-D1..SF-D9 are the decisions of record for the Social Foundation initiative.

---

## SF-D1 — Relationship dimensions: derive, never re-reduce

- **Evidence**: audit §1 — affinity is the single writer-owned scalar; familiarity/reliability/negative history/shared-ledger evidence/NPC web already persist independently.
- **Options**: (a) add new persisted dimension scores; (b) derive a composite profile view over existing state; (c) leave systems re-deriving ad hoc.
- **Decision**: **(b)**. `socialProfile.ts` derives the multi-dimensional profile (familiarity band, tier, reliability, guardedness, consolidated feeling, shared-history ledger, notable NPC bonds). No new persisted field; the five historical fallback duplications stay byte-identical at their call sites and new code reads `getEffectivePlayerAffinity`.
- **Consequences**: zero migration; dimensions can never disagree with writers; "affection" is deliberately NOT a second number — warmth is expressed by tier + reliability + feeling (zero-FOMO constitution).
- **Test**: SF1-01..20 (`socialProfile.test.ts`), including the derive-only deep-equal guard.
- **Status**: ADOPTED (shipped).

## SF-D2 — Familiarity is band-consumed, never capped or decayed

- **Evidence**: audit §1 — familiarity is unbounded, seeded 10, accumulates +1/+2/+4/+6/+8 by talk class; save-integrity test pins its unboundedness.
- **Decision**: bands only (`unfamiliar <10, passing <40, recognized <90, familiar <160, well_known ≥160`). No ceiling, no decay.
- **Test**: SF1-04.
- **Status**: ADOPTED (shipped).

## SF-D3 — Feeling: one canonical resolution chain

- **Evidence**: audit §1 — four mood-ish fields with two TTL clocks; engine + journal already agree on the chain `npcRuntime.emotion → rel.lastEmotion → moodToEmotion(prog.mood)`.
- **Decision**: `resolveCurrentFeeling` is THE canonical read for new systems; existing inline chains stay (contract-pinned) and a lockstep test asserts agreement.
- **Test**: SF1-05; engine/journal behavior untouched.
- **Status**: ADOPTED (shipped).

## SF-D4 — Player knowledge boundary mirrored once, lockstep-tested

- **Evidence**: journal owns `isNpcMemoryKnownToPlayer`; the social layer cannot import journal (journal consumes the emergent layer downstream — import-cycle analysis, audit §4/§6).
- **Options**: (a) duplicate predicate silently; (b) move journal's predicate into the social layer and re-export; (c) mirror + explicit lockstep test.
- **Decision**: **(c)** — `socialProfile.isMemoryPlayerKnown` mirrors journal's predicate; `SF1-03` asserts both agree across a full case matrix. Documented in both files. (Rejected (b): touching journal's exported API for an intra-layer refactor risks LR-3 merge conflicts for zero behavioral gain.)
- **Test**: SF1-03.
- **Status**: ADOPTED (shipped).

## SF-D5 — Context boosts: additive, band-clamped, boost-free parity

- **Evidence**: audit §2 — engine scoring is contract-pinned; min adjacent category-priority gap is 6 (relationship_tier 60 → emotion_reaction 54 → npc_gossip 48 → weather_season 42 → daily_slice 34).
- **Options**: (a) new engine selection mode; (b) wrapper re-ranking the input array (tie-breaks only); (c) optional additive boost parameter with hard clamp 5.
- **Decision**: **(c)**. `selectDialogueSession(..., contextBoosts?)` — undefined preserves byte-identical legacy ordering; boosts never cross a band (max 5 < min gap 6); protected categories (quest_milestone, invitation, conflict_reconciliation, personal_story) are never boosted; the only production producer is `dialogueContext.computeContextBoosts` wired at the single composition point (`buildResidentDialogue`). "No second selector" holds: condition gating, priorities, penalties and rotation remain engine-owned.
- **Consequences**: dialogue now breaks ties by lived context (shared-experience echoes first; reunion warmth helps tier topics clear small history penalties after ≥3 quiet days) without touching authored priorities.
- **Test**: SF4-01 (boost-free parity), SF4-03/04 (band protection + clamp), SF4-05/06 (echo, memory-bound), SF4-08 (reunion), full existing suite green boost-free.
- **Status**: ADOPTED (shipped).

## SF-D6 — Cancellation: compose the writers; no new outcome enum

- **Evidence**: audit §3 — decline is offered-only (contract), accepted invitations had NO player-facing exit; D7 registry-only policy; sanitizer whitelist is `completed|declined|expired`.
- **Options**: (a) new `cancelled` outcome (types + sanitizer + migration risk); (b) compose `expireInvitationsAt(forcedReason 'player_cancelled')` for accepted, `declineInvitation` for offered.
- **Decision**: **(b)** — truthful outcomes, zero schema change, zero-reward by construction (both writers are reward-free). If the owner later wants a distinct outcome, that is a schema decision, not a framework one.
- **Test**: SF2-05..10 (zero-reward guarantee, occupancy clearing, spacing preserved, sanitizer round-trip, fail-closed on expired records).
- **Status**: ADOPTED (shipped).

## SF-D7 — Capability evaluation is a registry query, not a second gate

- **Evidence**: audit §3 — `canOfferInvitation` is the contract-true eligibility owner; `SHARED_ACTIVITIES` is the data registry.
- **Decision**: `describeInvitationCapabilities`/`describeHostReadiness` compose the chassis gate and only DECOMPOSE its verdict into explainable standing (tier met? affinity met? cooldown days? guarded? available?). They never widen or re-implement a gate. Reusability contract: future hosts join by adding a registry def — the framework needs no change.
- **Test**: SF2-02..04, SF2-13.
- **Status**: ADOPTED (shipped).

## SF-D8 — Emergent seeds: player-known facts only, derive-only, silent degradation

- **Evidence**: audit §4 — journal knowledge boundary, `npc_social` firewall, ledger caps, zero-FOMO constitution ("no obligation mechanics").
- **Decision**: seven archetypes (open_visit, rift_bridging, shared_tradition, quiet_feeling, thank_you_owed, first_steps, community_pulse), each derived only from player-visible facts; capped at 6 by deterministic priority; bridging seeds additionally gated on *discovered* ties (`heardBellMystery` or a player-known memory naming both sides). Surfacing = one optional People-card chapter line (a whisper, not a log); no 5th journal tab; no timers, no penalties, no quest spawn.
- **Test**: SF3-01..16 (per-archetype trigger/silence, boundary cases, knowledge gate, cap/order/determinism, derive-only guard, chapter priority order).
- **Status**: ADOPTED (shipped).

## SF-D9 — Anti-omniscient event predicate for future content

- **Evidence**: audit §2 §7.1 — `requiresRecentEventKind/Tag` scan globally; unused in content but a trap.
- **Decision**: new engine condition `requiresWitnessedEvent { kinds?, tagPrefix?, maxDaysAgo }` — requires the event to list the speaker among its actors AND the speaker to hold a subjective memory bound to the event id. Additive; legacy predicates untouched (documented as deprecated-for-new-content in the contracts doc).
- **Test**: SF4-09 (actor-only fails, memory-only fails, actor+memory passes, kind filter).
- **Status**: ADOPTED (shipped).

## LR-3 reservation map (binding on this initiative)

The following are RESERVED to the LR-3 initiative per its approved docs (`docs/architecture/lr3/05-target-architecture.md`, `07-design-decision-register.md` @ `origin/docs/lr3-design`). This initiative neither defines nor shadows them: activity id `share_morning_pastry`; memory id `mem_lr_clara_morning_pastry`; npc memory tag `shared_morning_pastry`; interactable `bakery_cafe_table`; dialogue module `src/game/dialogue/invitations/clara.ts`; function `reconcileInvitedInteriorEntry` (in invitations.ts); eligibility reason `offer_phase_closed`; optional def fields `offerPhases` / `arrivalLine` / `summaryCompose`. Verified mechanically in the QA round (doc 04).
