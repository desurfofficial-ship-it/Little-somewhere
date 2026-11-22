# 01 — Audit Synthesis (Workstreams A–E research)

Five parallel read-only research passes audited the codebase before any design or code. This document synthesizes their findings; the full per-area detail lives in the research reports of record for this initiative.

## 1. Relationship architecture (Workstream A)

**As-built inventory** (all v11-persisted): `PlayerNpcRelation` (affinity 0–100 authoritative; unbounded `familiarity`; small-talk-capped `dailyAffinityGained`; `talkedCount`; `lastTalkDay/Phase`; `reliability` 0–100; `negativeCount`; `favorsCompleted`; `giftsGiven`; `lastEmotion`; mood + `moodUntilMinute`), `NpcNpcRelation` (canonical pair key, affinity −50..100, tension 0–100, `sharedTags` keep-last-5, gossip stamps), `ResidentProgress.trust` hearts 0–5 (write-back ratchet of affinity), bounded `npcMemories` (provenance/hops/confidence/distortion, cap 14/resident, TTL 5/18d), `worldEvents` (cap 40, 8 kinds), `invitations.history` (cap 12), `npcActivityHistory` (cap 8).

**Key findings adopted by design:**
- The model is NOT one number — affinity is the scalar writers maintain, but familiarity, reliability, negative history, shared-ledger evidence and the NPC web already exist as independent dimensions. What was missing is a canonical *derived view* and the discipline of reading through it.
- Five call sites duplicated the affinity fallback (`rel?.affinity ?? prog.trust * 20`) and the feeling chain (`rt?.emotion ?? rel?.lastEmotion ?? moodToEmotion(prog.mood)`) — a divergence class waiting to happen.
- Trust/affinity desync is possible if any writer bumps affinity without re-deriving hearts (the ratchet contract).
- Guardedness has a boundary asymmetry (`< 20` vs `<= 20`) and kindred-but-guarded is reachable only via hand-edited saves — worth an explicit coherence probe, not a silent repair.
- Write-only persisted fields exist (`familiarity`, `giftsGiven`, `favorsCompleted`, `invitations.history`, `lastTalkPhase`, …) — consuming them through derivation (not pruning) is the zero-migration path to making them matter.
- NPC-to-NPC bonds have baseline bonds + encounter/gossip drift but **no day-decay by design** (zero-FOMO constitution: "no decay"). Suppressed pairs (affinity < 0 ∨ tension ≥ 45) stay suppressed — that is story material, not a defect to auto-heal.

## 2. Dialogue engine (Workstream B)

**Pipeline of record**: `buildResidentDialogue` (narrative.ts, sole production caller) → `selectDialogueSession` (pure, deterministic, RNG-free) → condition filter in registry order → score = `CATEGORY_PRIORITY[category] + topic.priority − history penalties` → stable sort (registry order breaks ties) → anti-back-to-back hard rule → session build with injection sequence (concurrent quests, gift choice, amends) → `surfacedMemoryEventIds` per-topic handling → `applyDialogueChoice` flips `mentionedToPlayer`.

**Key findings adopted by design:**
- The engine is contract-pinned: 86-topic golden snapshot (id sequence + field-for-field metadata), full-cast × phase sweep, BD10-09 determinism hash, BD10-10 anti-fraud backstop. Any extension must be **additive** and boost-free-parity-tested.
- Repetition control already exists (per-topic history, same-day −28, seen-count penalty, −120 last-topic, hard rotation). The real gaps: no relationship/memory-aware *tie-breaking*, and no everyday conversational afterlife for shared-visit memories (they were only ever surfaced inside the visit itself).
- Anti-omniscience is strong where it matters (`playerRelationWith`, third-party gossip, epilogues all knowledge-gated), but `requiresRecentEventKind/Tag` scan `worldEvents` **globally** — a documented trap for future content that needs a witness-scoped sibling predicate.
- The sanctioned extension workflow: append topics at the registry tail → regenerate golden via `scripts/snapshot_topics_runtime.ts` → hardcode expectations outside the golden (BD10-10 pattern).

## 3. Invitation chassis (Workstream C)

**State machine of record**: single active slot (`offered|accepted` → terminal outcomes `completed|declined|expired`), strict predicate duality (`isInvitationExpired ≡ !isInvitationLive`) across tick/save/load, anchored windows (contiguous home availability; morning cap 719 policy), 2-day spacing, history cap 12, occupancy written ONLY by the enter reducer, completion as a single transactional owner with idempotency guards, every mutation through exactly six canonical writers.

**Key findings adopted by design:**
- The chassis is already host-agnostic in its pure core (gates are def-driven) but the *venue wiring* (enter/exit reducers, toasts, station guards, occupant rig) is venue-specific — which is precisely LR-3's mandate (D5/D6/D8) and must not be pre-empted.
- Genuinely missing capability, owned by nobody: **player-initiated cancellation** of an active invitation (post-acceptance withdrawal). Satisfiable with zero schema change by composing `expireInvitationsAt` with a forced reason (outcome stays 'expired'; the machine reason carries the nuance).
- Import discipline: a new framework module at the TOP of the game graph is cycle-free; `occupancy.ts` must stay a leaf and `activities.ts`'s inlined window check must stay (cycle avoidance, contract-pinned).
- LR-3 reservation map (from its approved docs, binding): `share_morning_pastry`, `mem_lr_clara_morning_pastry`, `shared_morning_pastry`, `bakery_cafe_table`, `dialogue/invitations/clara.ts`, `reconcileInvitedInteriorEntry`, reason `offer_phase_closed`, def fields `offerPhases`/`arrivalLine`/`summaryCompose`.

## 4. Story & journal (Workstream E)

**Pipeline of record**: 6 scripted storylines (single writer `advanceStorylineInPlace`), Pocket Journal as a pure per-call derivation over WorldState (Stories/Memories/People/Discoveries), player knowledge boundary `isNpcMemoryKnownToPlayer`, `npc_social` world events firewalled from the player.

**Key findings adopted by design:**
- The richest untapped emergent material: NPC-to-NPC bonds (journal never reads `npcRelations`), invitation history (write-only), community counters, observable feelings, keepsake reciprocity.
- The journal People card is the lowest-risk surfacing slot (optional field + conditional render; no pinned array touched); a 5th tab was rejected (union ripple across JournalDrawer chrome/counters).
- Emergent seeds must respect the knowledge boundary AND degrade silently when inputs are evicted (memory TTLs, ledger caps).

## 5. LR-4 / LR-5 preparation (Workstream D)

**Dependency facts**: `TeachingState { known: string[] }` persists since v11 with zero production writers; `knowledgeGranted` already sits on the shipped nook def; `requiresTeachingKnown` condition is implemented but unused; sanitizer defers unknown-id stripping to "the LR-4 activity registry". Copperwheel interior contract (Build 9) is fully merged — bounds/obstacles/interactables/seat spots/projects — but has no occupant anchor constants and no invitation wiring. Resolved-by-events: the reliability gate (PR #11/#12 merged) unblocked implementation on integrated main.

**Unresolved decisions carried into the specs** (23/24 docs): LR-4 scope (grant mechanics only vs second knowledge id), TeachingState shape (keep `{known}` vs doc-05 sketch's taughtBy/taughtDay → v12), KnowledgeId typing (union vs registry set), LR-5 occupant anchor engineering, D9 venue-true completion text, D6 venue-true accept toast, D5 shared enter helper, D8 rig parameterization, D10 offerPhases (USER-approved, LR-3-owned), Arthur discoverability gate.
