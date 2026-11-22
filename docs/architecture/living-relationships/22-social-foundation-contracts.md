# 22 — Social Foundation Contracts (SF-1..SF-4, as-built)

- **Date**: 2026-11-22
- **Status**: IMPLEMENTED & verified (588/588, `tsc` clean, build green). Complements LR-1/LR-2 (merged); LR-3 (Clara/bakery) untouched — reservation map in §7.
- **Authority basis**: `14-revised-architecture.md` (spec of record), `docs/architecture/social-foundation/01..03` (audit synthesis, decisions, implementation record).
- **Reader map**: `WORKLOG.md` Entry 057; decisions `docs/architecture/social-foundation/02-design-decision-register.md`.

The Social Foundation is a **pure derivation and composition layer** over the Living Relationships chassis. It adds no persisted state (WorldState stays **v11**), owns no reducers, and never writes `invitations` / `occupancy` / `activeActivity` / relations directly. Everything below is binding on future social work (LR-4, LR-5 and beyond).

---

## §1 — SF-1 `socialProfile.ts` (relationship architecture)

**Doctrine**: derive-only (same rule as `progressionVisuals.ts`: never persist a derived flag). The layer answers "what IS this relationship" from writer-owned state; it never repairs, clamps or mutates.

| Export | Contract |
|---|---|
| `getEffectivePlayerAffinity(world, id)` | The one canonical affinity read: `rel.affinity` when finite, else `prog.trust * 20`. New systems MUST read through it. The five historical inline fallbacks stay byte-identical (contract-pinned). |
| `isMemoryPlayerKnown(entry)` | Mirror of `journal.isNpcMemoryKnownToPlayer`. Lockstep-pinned (SF1-03): if either side changes without the other, the test fails. Never widen this boundary. |
| `getFamiliarityBand / Label` | Bands 10/40/90/160; unbounded, never decayed (SF-D2). |
| `resolveCurrentFeeling(world, id)` | Canonical feeling chain `npcRuntime.emotion → rel.lastEmotion → moodToEmotion(prog.mood)` — identical to engine/journal chains (SF-D3). |
| `deriveSharedHistory(world, id)` | Evidence ledger over `invitations.history` (host-filtered outcomes + activity titles), `world.memories` (residentId-filtered, cap 6 sample), `player_help` world events (actors), keepsake record, and speaker-knowledge counts under the boundary. |
| `getNotableNpcBonds(world, id)` | Confidant/warm/guarded/estranged bonds only ('acquainted' is background); deterministic sort (affinity desc, then id). |
| `getSuppressedNpcPairs(world)` | All pairs where `shouldSuppressNpcSocial` holds — canonical keys, deduped, sorted. The stuck social energy of the lane (story material; NO auto-healing by design). |
| `meetsRelationshipUnlock / meetsStrictRelationshipUnlock` | The two contract-true readings named once: OR (invitation chassis, gate 5) and AND (dialogue conditions). New gates must pick one of these, not invent a third. |
| `buildRelationshipProfile(world, id)` | The composite view (§1 of doc 01). |
| `findRelationshipIncoherencies(world)` | Read-only coherence probes: `trust_heart_drift`, `affinity_out_of_range`, `kindred_but_guarded`, `met_without_familiarity`, `noncanonical_pair_key`, `pair_resident_unknown`. Tests/tooling assert on contradictions; nothing auto-repairs. |

**Tests**: `src/game/socialProfile.test.ts` (SF1-01..20), including the deep-equal derive-only guard.

## §2 — SF-2 `invitationFramework.ts` (invitation reusability)

**Rules of engagement** (binding):
1. Six canonical writers remain the ONLY mutators of invitation state. The framework composes them; it never writes slices directly.
2. Registry-only persistence: cancellation rides outcome `'expired'` + machine reason `player_cancelled`. NO new outcome enum without an owner-approved schema decision (D7 stop-rule).
3. Capability evaluation decomposes — never re-implements — `canOfferInvitation`.

| Export | Contract |
|---|---|
| `PLAYER_CANCELLED_REASON` / `INVITATION_REASON_LABELS` / `getInvitationReasonLabel` | Machine reasons → player-legible copy for every chassis reason (+ graceful fallback for unknown reasons). UI must render through this map. |
| `cancelActiveInvitation(world)` | Player-initiated withdrawal. `offered` → composes `declineInvitation` (outcome 'declined', no reason field); `accepted` → composes `expireInvitationsAt(…, 'player_cancelled')` (outcome 'expired' + reason). Always clears `occupancy`/`activeActivity`, always zero-reward, preserves spacing stamps, fail-closed on non-live records. Returns the mutated world (chassis convention) — callers apply `result.world`. |
| `describeInvitationCapabilities(world, hostId?)` | One row per `SHARED_ACTIVITIES` def: chassis verdict + decomposed standing (tier/affinity met, guarded, availability, cooldown days). **Reusability contract: a future host joins by adding a registry def; this query picks it up with no code change.** |
| `describeHostReadiness(world, hostId)` | Compact actionable summary (met, tier, guarded, available, phase, registry presence). |
| `getInvitationLedger(world)` | Derived active view (live flag), labeled history (`Completed` / `Declined` / `Stepped back` / `Quietly passed`), caps, per-host cooldown days. Derive-only. |

**Tests**: `src/game/invitationFramework.test.ts` (SF2-01..13) incl. sanitizer round-trip of the cancelled entry (zero warnings).

## §3 — SF-3 `emergentStories.ts` (emergent stories)

**Doctrine**: stories emerge from interconnected systems, not from new state. Seven archetypes, each derived from player-visible facts only, silent when evidence is absent, silent when inputs are evicted (TTL/caps), deterministic, capped `MAX_SEEDS = 6` by priority (ties by id):

| Kind | Trigger (all player-visible) | Priority |
|---|---|---|
| `open_visit` | Accepted + live invitation, player outdoors | 80 |
| `rift_bridging` | Suppressed NPC pair + player ≥ friendly with BOTH + player knows the tie (`heardBellMystery` or a player-known memory naming both) | 70 |
| `shared_tradition` | ≥ 2 completed visits with one host | 60 |
| `quiet_feeling` | Closest-known resident's observable feeling low (sad/frustrated/wistful) | 50 |
| `thank_you_owed` | Keepsake received, never acknowledged, ≥ acquaintance | 40 |
| `first_steps` | Met, talked < 3 | 30 |
| `community_pulse` | Sum of shared-doing counters ≥ 8 | 20 |

**Zero-FOMO rule**: seeds never create obligations, timers, penalties or quests. Phrasing avoids must/need-to/deadline language (pinned SF3-01).

**Surfacing**: `deriveResidentChapter(world, id)` provides ONE optional line for the People card, resolved in story-priority order (bridging → tradition → keepsake → feeling → early acquaintance). Journal integration: `JournalPersonCard.chapter?` (optional field; unmet stub path untouched; no pinned array changes).

**Tests**: `src/game/emergentStories.test.ts` (SF3-01..16).

## §4 — SF-4 `dialogueContext.ts` + engine seams (dialogue)

**"No second selector" holds**: condition gating, `CATEGORY_PRIORITY`, history penalties, rotation, injection sequence and surfaced-memory ownership remain `dialogueEngine.ts`'s alone. SF-4 adds:

1. **`selectDialogueSession(..., contextBoosts?)`** — optional additive boosts keyed by topic id. `undefined`/`{}` = byte-identical legacy ordering (pinned SF4-01). Boosts are clamped to `MAX_CONTEXT_BOOST = 5`, strictly below the minimum adjacent category-priority gap (6): they reorder WITHIN a band and can never cross one (pinned SF4-03/04). Protected categories (`quest_milestone`, `invitation`, `conflict_reconciliation`, `personal_story`) are never boosted.
2. **Boost rules** (each evidence-bound to the speaker's own knowledge):
   - **R1 shared-experience echo** (+5): the speaker holds an unmentioned `shared_*` memory (≤ 6 days) and the topic's `requiresNpcMemory.tags` targets that tag. Retires once mentioned (no nagging).
   - **R2 reunion warmth** (+3): ≥ 3 quiet days since last talk, `relationship_tier` band — helps tier topics clear small history penalties after a quiet spell.
3. **`buildDialogueContext` / `describeDialogueContext`** — the deterministic conversation snapshot (standing, guardedness, recency, pending live visit, days since shared visit, unmentioned shared tags, today's company, open friction, knowledge counts) and its human one-liner.
4. **`requiresWitnessedEvent { kinds?, tagPrefix?, maxDaysAgo }`** — the knowledge-scoped event predicate: speaker must be an event actor AND hold a memory bound to the event id. **New content must use this, not the global-scan `requiresRecentEventKind/Tag`** (those are frozen for compat, deprecated for new content).
5. **Production wiring**: `buildResidentDialogue` (single composition point) computes boosts and forwards them; its 3-arg public signature is unchanged.

**Content addition** (sanctioned append-only workflow): `everyday_shared_visit_echo` (`dialogue/everyday/reflections.ts`, category `event_reaction`, priority 14, tail of the registry; golden regenerated **85 → 86**; justification: gives shared-visit memories their everyday conversational afterlife under the proven `requiresNpcMemory unmentionedOnly` pattern; engine surfaced-memory branch added for the topic id; SF4-07 pins the tail position as the anti-fraud backstop).

**Tests**: `src/game/dialogueContext.test.ts` (SF4-01..11).

## §5 — Golden snapshot regeneration record

`scripts/dialogue-topics-golden.json` regenerated with `npx tsx scripts/snapshot_topics_runtime.ts scripts/dialogue-topics-golden.json`. Change: exactly ONE appended topic at the tail (`everyday_shared_visit_echo`); no existing topic id, order, condition, priority, category or residentId modified; count 85 → 86. BD10-10/11 wilds+invitation expectations untouched and green. The new tail position is itself pinned (SF4-07).

## §6 — Workstream F — adversarial QA

Independent adversarial round + browser verification: `docs/architecture/social-foundation/04-adversarial-qa.md`. Covered classes: contradictory relationship states (SF1-13..18), impossible social interactions (SF2-07/10, SF2-05/06 zero-reward), interruption/expiry interplay (SF2-10), persistence (SF2-08 sanitizer round-trip), dialogue determinism + boost-free parity (SF4-01..04), knowledge-boundary leaks (SF3-03/05, SF1-03), storyline continuity (full pre-existing suite green, incl. LR-1/LR-2 batteries, tick/load parity pins, BD10 determinism hash).

## §7 — LR-3 reservation map (binding)

Reserved to the LR-3 initiative (do not define, shadow, or implement in parallel work): `share_morning_pastry`; `mem_lr_clara_morning_pastry`; `shared_morning_pastry`; `bakery_cafe_table`; `src/game/dialogue/invitations/clara.ts`; `reconcileInvitedInteriorEntry`; eligibility reason `offer_phase_closed`; optional def fields `offerPhases` / `arrivalLine` / `summaryCompose`. The QA round mechanically verified none of these exist in this tree.

## §8 — How to add the next host (the reusability payoff)

1. Add a `SharedActivityDef` to `SHARED_ACTIVITIES` (host binding, seat constants, memory ids, optional `knowledgeGranted` for LR-4-style grants).
2. Add the venue wiring per the established enter-reducer pattern (LR-3's D5 shared helper lands as the canonical path — adopt it, don't fork it).
3. Add the dialogue quartet module + aggregator spread + golden regen (§5 workflow).
4. Everything else — capability rows, readiness, ledger labels, cancellation, coherence probes, emergent seeds (tradition/bridging/feeling), journal chapter — picks the host up automatically.
