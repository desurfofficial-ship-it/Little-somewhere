# Social Foundation — Post-Integration Adversarial Audit
# 08 — Persistence, Determinism, and Performance

**Method:** specialist analysis (P1-F) + independent adversarial determinism/corruption program (P1-I, doc 12). All measurements are real, not estimates; scripts preserved under the audit scratch workspace.

## 1. Architectural boundaries (§10.1)

- Zero `three`/`react`/`window`/`document`/`localStorage`/`Math.random`/`Date.now`/`performance.now`/`setTimeout` in the four SF modules (grep-verified; only false-positive comment matches like `windowStartMinute`). All randomness flows through the seeded `mulberry32` RNG, untouched by SF.
- Boundary guard (CI step): "three-layer boundary intact, src/game production acyclic — 61 game / 61 scene / 11 component files"; the single reported violation is the pre-existing sanctioned W5 (`journal.ts` localStorage, until Phase E5), whose code paths are byte-unchanged by the SF diff.
- Module graph (scoped set) verified **acyclic** with correct direction: `socialProfile → {types, relationships, residents, activities, memories}`; `invitationFramework → {…, socialProfile}`; `emergentStories → {…, socialProfile}`; `dialogueContext → {…, dialogueEngine, socialProfile}`; `narrative → {dialogue, dialogueEngine, dialogueContext}`; `journal → {…, emergentStories, narrative}`; UI imports game only (`JournalDrawer → journal`). Notable: `dialogueEngine` does **not** import `dialogueContext` (cycle avoided); the `dialogueContext → dialogueEngine` edge exists only for an **unused import** (`getTopicHistoryEntry`, dialogueContext.ts:17 — P3 phantom edge, one accidental future import away from a genuine cycle).
- Four SF public APIs crash on unknown resident ids while SF-3 degrades silently (R-10, doc 03 §6) — an inconsistent robustness contract across the new modules.

## 2. Derived-vs-persisted (§10.1) — zero schema change

- `CURRENT_SCHEMA_VERSION = 11` at both `e3f86b8` and `8b715fc` (`git log -S` confirms no bump in range); `types.ts` diff is additive-only (`DialogueCondition.requiresWitnessedEvent` — a dialogue-time condition, never serialized) plus the runtime-only `JournalPersonCard.chapter?`.
- `InvitationHistoryEntry.reason?: string` **pre-existed** at `e3f86b8` (types.ts:601-608) — as did the forced-reason writers (`'day_end'`, `'host_unavailable'`). SF added **zero schema surface**; old v11 saves need no migration.
- The serializer rebuilds state from an explicit allow-list (`sanitizeWorldState`, migrations.ts:1203-1529) — hostile-attachment round trips (profiles, seeds, boosts, ledgers, `chapter` attached to the world object; unknown keys injected into the raw payload) produce **byte-identical JSON**; everything derived is structurally dropped.

## 3. Tick and lifecycle behavior (§10.2)

Invitation transitions happen at five pre-existing chassis points (tick reconciler while the clock advances — frozen during pause/dialogue; room transitions; +2h; day roll; accept-failure recovery). SF layers are computed **on demand** (dialogue open via `narrative.ts:399`; journal per commit; the rest test-only) — never ticked. Same-tick cancel × natural-expiry double-archive is **unreachable** (both orderings measured: expiry-then-cancel → `no_active_invitation`; cancel-then-expiry → `expired:false`; history length stays 1). Repeated evaluation has no side effects (SF1-19/SF3-13 deep-equal pins). Boost feedback loops are self-extinguishing (doc 06 §4).

## 4. Persistence under corruption (§10.3)

Sanitizer behavior measured for every corruption class the SF layers read (adversarial program, doc 12 §4): affinity `"abc"` → default-clamped; NaN/Infinity literals → invalid JSON → fresh world with warning; truncated payload → fresh world + warning; doubled JSON keys → last-wins then sanitizer dedupe; corrupted active invitation → cleared with warning, SF sees clean state; history rows with bogus outcome/ghost host/negative day → dropped (**silently** — pre-existing observability asymmetry vs npcMemories, which warn); weird-reason expired rows kept with reason ✓; partial/null npcMemories → malformed rows dropped with warning; future-day worldEvents → shape-validated, ghost actors filtered; `neighborGiftsReceived` junk → filtered, keepsake seed correct; `schemaVersion: 12` → conservative sanitize, payload never rewritten (v11 boundary intact); `schemaVersion: 3` → full migration chain → v11 clean. Cancel-after-load archives exactly once. `serialize∘deserialize∘serialize` byte-equal. **Every corrupted class converges before SF reads it.**

## 5. Long-run simulation (§10.4) — measured

60-day harness (real reducers only: offer/accept/cancel cycles honoring spacing, 600 dialogue choices via `applyDialogueChoice`, daily journal builds, save/load every 5 days):

| Metric | Day 1 | Day 60 |
|---|---|---|
| serialized payload | 28,039 B | 45,960 B (+17.9 KB, dominated by pre-existing topicHistory + journal memories) |
| world.memories | 1 | 14 (cap 96) |
| invitations.history | 0 | 12 = cap (12/12 `player_cancelled` reasons intact post-load) |
| worldEvents | 0 | 26 (cap 40) |
| topicHistory keys | 0 | 90 (registry-bounded) |
| deriveEmergentStorySeeds | 0.075 ms | 0.016 ms |
| buildPocketJournalView | 0.41 ms | 0.33 ms |
| computeContextBoosts ×9 | 0.035 ms | 0.034 ms |
| buildResidentDialogue ×9 | 0.61 ms | 0.43 ms |
| serializeWorldState | 0.87 ms | 0.94 ms |

No super-linear growth; all derive costs sub-millisecond and flat day 1 → day 60. Repo harness `longrun_stress.ts` (scenarios A–G, 2000 ticks each): zero invariant violations, payloads ≤ 110 KB under invitation/gossip pressure with all caps engaged.

**SF-attributable save delta:** 19,838 B (cancel path) vs 19,730 B (natural `day_end` expiry equivalent) = **+108 B** total (12 history rows × 9 chars of reason-string difference) — bounded by the cap.

## 6. Determinism (G7)

- Repeat derivation ×N: identical. Serialize→deserialize→derive: JSON-identical for every SF surface (seeds, chapters ×9, boosts ×9, contexts ×9, ledger, profiles ×9, probes).
- **Key-insertion-order perturbation** (reversed `npcRelations`/`playerRelations`/`npcMemories` object orders): outputs identical (sorted scans + `RESIDENT_ORDER` + sorted tag/company sets). The one order-sensitive input is the `invitations.history` **array order** (array semantics: reversing it legitimately changes the tradition seed's "latest visit" text — noted as a P3 semantics inconsistency with `lastCompletedVisitDay`'s `Math.max`).
- 10-day forward replay from the day-60 save, run twice from the same seed state: **byte-identical** (45,857 B ×2).
- Repo determinism/twin scenarios: byte-identical.

## 7. Performance micro-costs (§16, measured, day-60 state, 100-iter means after warmup)

| Operation | Cost |
|---|---|
| `deriveResidentChapter` ×10 residents | 0.0645 ms |
| `buildRelationshipProfile` ×10 | 0.0782 ms |
| `deriveEmergentStorySeeds` | 0.0201 ms |
| `getInvitationLedger` | 0.0073 ms |
| `describeInvitationCapabilities` | 0.0019 ms |
| single-resident `buildResidentDialogue` | 0.0478 ms |

Baseline vs SF cost vs harness cost cleanly separated: everything SF adds is microseconds against frame budgets; the only unbounded input is in-session `world.memories` growth (capped at next save/load; P3).

## 8. Verdict

Persistence-inert, determinism-clean, cap-respecting, performance-negligible. No P0/P1/P2 in this domain; P3s are hardening/observability items (unused import edge, silent history-row drops — pre-existing, throw-on-unknown-id consistency).
