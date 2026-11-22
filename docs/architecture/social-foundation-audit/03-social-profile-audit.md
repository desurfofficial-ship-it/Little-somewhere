# Social Foundation — Post-Integration Adversarial Audit
# 03 — Social Profile Audit (SF-1)

**Subject:** `src/game/socialProfile.ts` (546 lines, new in `8b715fc`) and its callers.
**Central question (brief §5):** does the module derive a useful social interpretation from existing authoritative state, or introduce competing truths that can contradict the underlying relationship model?
**Method:** specialist analysis (P1-A) with scratch-script reproduction; findings re-adjudicated in the adversarial rounds (doc 12).

## 1. Source-of-truth analysis (§5.1)

Every exported value is a pure function of `WorldState` at call time. No module-level mutable state, no cache, no invalidation surface, no persistence (proved by SF1-19 deep-equal pin + hostile-attachment serialization round trip, doc 08 §2). Consumers (grep-verified): `dialogueContext.ts`, `invitationFramework.ts`, `emergentStories.ts`, and `journal.ts` (transitively via `deriveResidentChapter`). Four exports have **zero production consumers** today (tests only): `buildRelationshipProfile`, `getNotableNpcBonds`, `findRelationshipIncoherencies`, `meetsStrictRelationshipUnlock` — legitimate foundation staging.

Key derivations and their authoritative sources:

| Derived value | Authoritative source | Notes |
|---|---|---|
| `getEffectivePlayerAffinity` | `playerRelations[id].affinity`; fallback `(trust ?? 0) * 20` | fallback proven **seed-exact** for all 10 residents vs `createInitialPlayerRelations` (divergence needs trust ∉ [0,5], unreachable — every trust writer clamps). Residual: the accessor is *stricter* than the legacy duplicates it mirrors (rejects non-finite affinity; the 8 pinned duplicate sites would return NaN) |
| Familiarity bands | `rel.familiarity` (writers +1/+2/+4/+6/+8, seed 10) | thresholds 10/40/90/160 pinned by SF1-04 |
| `resolveCurrentFeeling` | `npcRuntime.emotion` → `rel.lastEmotion` → `moodToEmotion(prog.mood)` | identical chain to dialogue/journal; does not consult `emotionUntilMinute` (inherited transience, by design) |
| `deriveSharedHistory` | 4 bounded ledgers + keepsake record | `world.memories` is **newest-first** (20 prepend writers, 0 append writers — grep-proven), so `slice(0,6)` = newest 6 as documented; `invitations.history` cap 12 keeps newest tail; `completedVisits` therefore oldest-first and "latest = last element" is correct |
| `getSuppressedNpcPairs` | real `npcRelations` keys only | skips unknown/a==b; sorted by pair key |
| Unlock readings | OR = `invitations.ts` gate; AND = `evaluateDialogueCondition` | SF1-10 pins both against behavior |

## 2. Relationship coherence (§5.2)

Adjudicated matrix: high familiarity/low affinity (coherent — long acquaintance, cold phase); low familiarity/high affinity (coherent); high affinity + suppressed pair (deliberate — the bridging design, knowledge-gated); positive shared history + current conflict (coherent bittersweet state — but see R-01: the coherence *probe* mislabels it); no shared history + strong affinity (coherent); missing references (synthetic `getNpcRelation` fallback — see R-11 phantom bonds); unknown ids (pairs skipped/probed; composite builder **throws** — R-10); save/load reconstruction (sanitizer re-coheres trust↔affinity on every load — probes silent on sanitized worlds).

## 3. NPC pair identity (§5.3)

`getNpcPairKey` (relationships.ts:22-24) is lexicographic-canonical, involutive (A→B ≡ B→A proven), stable, and collision-free (resident IDs are fixed code constants; none contain `:`; no dynamic ID generators exist). All writers route through it — duplicate bond records unreachable. `findRelationshipIncoherencies` catches mirrored/noncanonical/unknown keys. Gap: `getSuppressedNpcPairs` is "deduped" only against identical keys — a mirrored duplicate key (corruption class) yields two suppressed-pair rows pre-sanitize (P3, doc precision; the probe does flag it).

## 4. Shared-history ledger (§5.4)

Bounded: `completedVisits` ≤ 12 (global history cap), `playerMemories` ≤ 6 sample, help-event counts bounded by `MAX_WORLD_EVENTS = 40`. Dedup at write time (memory ids) and load time (invitation rows). No unbounded structure **except** `world.memories` itself, which is capped to 96 only on load — in-session growth is unbounded (P3 perf note R-10; magnitude small). Save/load reconstruction clean.

## 5. Abstraction quality (§5.5)

Single responsibility (pure derivation); dependency direction correct and **acyclic** (graph in doc 08 §1); zero DOM/React/Three.js; testable without browser state (62 tests green headless); deterministic (sorted outputs, total comparators). The `isMemoryPlayerKnown` predicate is **logically identical** to `journal.isNpcMemoryKnownToPlayer` (token-for-token; SF1-03 covers all 4 enum values at the value level). Limitation: the lockstep is *behavioral and sampled, not structural* — a future edit consulting another memory field escapes the matrix until cases are hand-added (P3).

## 6. Findings

- **R-01 (P2) — `kindred_but_guarded` probe false-positives in ordinary play.** `isResidentGuarded` (relationships.ts:85-98) is true when the lifetime `negativeCount > 0` (never decremented) coincides with a transient frustrated/angry/embarrassed feeling — routinely reachable (autonomous needs-decay sets `frustrated` at hunger < 26, simulation.ts:378; shipped dialogue choices set embarrassed/frustrated; talk mirrors emotion for 90 min). A scratch repro built **entirely from canonical writers** fired the probe. The module doc ("possible only through hand-edited/corrupted saves", socialProfile.ts:472-474) and the SF1-16 title are therefore false. Impact: QA-gate noise — if LR-3+ QA adopts SF1-13-style "coherent world reports zero incoherencies" assertions, they will false-fail. Not a corruption/leak. Recommended fix: probe on persistent-state guardedness only (reliability/negativeCount), or correct the doc.
- **R-11 (P3) — phantom "guarded" NPC bonds.** `getNotableNpcBonds` surfaces the synthetic fallback (arthur pairs default 10/10 → tier `guarded`) as if recorded evidence: on a fresh world, 7 of Arthur's 9 "notable bonds" are model defaults with no persisted record. Zero production consumers today; rises to P2 if a social-web UI ever renders `notableBonds` (7 of 9 bonds would display as rifts on day 1).
- **R-10 (P3, hardening, shared with SF-4) — throw-on-unknown-id.** `buildRelationshipProfile` (socialProfile.ts:405/418) throws for an id absent from `RESIDENTS` (the pair probes guard; the composite builder does not). All current callers pass registry ids; any future caller with a save-derived id crashes. Same class: `buildDialogueContext`, `computeContextBoosts`, `describeHostReadiness`.
- **P3 batch:** mirrored-key "deduped" wording; NaN double-report in the probe (`affinity_out_of_range` + `trust_heart_drift` for one root cause) and `getRelationshipTier(NaN)` → `'kindred'` (NaN comparisons fall through — unreachable via the guarded accessor); doc-count imprecision in the "five historical call sites" comment (actual: 8 exact-shape sites in 6 files; `invitations.ts`/`activities.ts` named in the comment contain zero such fallbacks); in-session `world.memories` growth; two divergent `guarded` views (`invitationFramework` uses runtime-only emotion, `dialogueContext`/socialProfile use the full chain — constructed divergence proven; both are pre-existing patterns the layer was meant to consolidate).

## 7. Verdict (SF-1)

The module **does** derive a useful interpretation and does **not** introduce competing truths: no cache, no persistence, no drift-inducing shortcuts; fallbacks seed-exact; knowledge predicate byte-equivalent to the journal's. One substantive defect (R-01) is a diagnostic-layer false positive, not a state contradiction.
