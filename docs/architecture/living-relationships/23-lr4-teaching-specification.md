# 23 — LR-4 Teaching Specification (implementation-ready)

- **Date**: 2026-11-22
- **Status**: READY — implementation-ready on integrated main (`a80a220`). No feature code written (deliberate; see §9).
- **Definition of record**: `14-revised-architecture.md` §10 LR-4 row: *"Teaching flag on the nook or bakery activity (one knowledge id)"* (`:294`). Milestone numbering per the settled chain of record: LR-1 → LR-2 → LR-3 (Clara/bakery, in flight, owned) → **LR-4 (teaching)** → LR-5 (Arthur/Copperwheel) — doc 10's older LR numbering is historical.
- **Preparation audit**: `docs/architecture/social-foundation/01-audit-synthesis.md` §5.

---

## 1. As-built source seams (verified `file:line` @ `a80a220`)

| Seam | Fact |
|---|---|
| `types.ts:627-629` | `TeachingState { known: string[] }` — loose string array; no `taughtBy`/`taughtDay` (doc 05's sketch was NOT implemented). |
| `types.ts:788` | Slice lives in the v11 WorldState; seeded by `migrateV10ToV11` (`migrations.ts:2407`) and `createDefaultWorldState` (`migrations.ts:301`). |
| `activities.ts:48-49, 70` | `SharedActivityDef.knowledgeGranted?: string` exists and is set on the shipped nook def (`'nora_featured_reading'`) but is **never read** by `completeSharedActivity`. |
| `activities.ts:161-336` | `completeSharedActivity` — the single transactional completion owner (doc 14 §5.1). The knowledge grant belongs HERE (doc 14 §7 `:234`: "Knowledge grants | `completeSharedActivity` only, from the activity def"; invitation carries no taughtTopicId). |
| `dialogueEngine.ts:506-511` (pre-SF line refs) | `requiresTeachingKnown?: string[]` — ALL-known semantics, absence = pass. Implemented, unit-tested, zero content users. |
| `migrations.ts:1825-1832, 1841` | Sanitizer dedupes + filters non-empty; **unknown-id stripping explicitly deferred to "the LR-4 activity registry"** (`20-lr1-implementation-notes.md:66`). |
| `storage.ts:489-491` | Save revision already fingerprints `teaching.known` (autosave change detection works day one). |
| `simulation.ts:1116` | Pure-wrapper clone already copies the slice (zero-GC parity contract). |
| `dialogueEngine.ts` (post-SF) | `dialogueContext.computeContextBoosts` + `requiresWitnessedEvent` are available; teaching topics should NOT be boost-targeted (protected categories). |
| SF-2 (`invitationFramework.ts`) | `describeInvitationCapabilities` rows expose standing; teaching state is NOT a gate there and must not become one (invitation gates stay chassis-owned). |

## 2. Scope

### 2.1 In scope

| ID | Item |
|---|---|
| L4-S1 | Grant transaction: inside `completeSharedActivity`, after the memory-id idempotency guard, append `def.knowledgeGranted` to `world.teaching.known` when defined and absent (once-only by construction: repeat completion is already blocked by the guard). |
| L4-S2 | Knowledge-id registry: `export const KNOWLEDGE_IDS` (const-mapped or frozen set) — at minimum `{ 'nora_featured_reading' }` plus the registry used by the sanitizer. Typing decision D-4A below. |
| L4-S3 | Sanitizer upgrade: strip unknown ids from `teaching.known` WITH a warning (closing the doc-20 §5.5 deferral); dedupe + clamp unchanged otherwise. |
| L4-S4 | First `requiresTeachingKnown` content topic (one, in `src/game/dialogue/` modules — never `narrative.ts`): a Nora post-reading "what you learned" everyday line, gated `requiresTeachingKnown: ['nora_featured_reading']` + `requiresNpcMemory` unmentioned shared-reading memory, appended at the registry tail; golden regen with justification (§5 workflow of doc 22). |
| L4-S5 | Acceptance battery §6 (red-test-first). |

### 2.2 Out of scope (with reasons)

- Second knowledge id / Arthur content (`arthur_escapement_basics` is LR-5's payload; shipping it early would couple LR-4 to LR-5's venue wiring).
- `taughtBy` / `taughtDay` stamps (doc 05 sketch) — new persisted state → v12; D-4B decision required first; the {known} shape satisfies every LR-4 acceptance observable.
- Skill-tree UI, currencies, decay (constitution).
- Any LR-3 surface (Clara/bakery); LR-3's acceptance asserts `teaching.known` stays EMPTY after its completions — LR-4 must not change that contract for the bakery path (no `knowledgeGranted` on Clara's def, per LR-3 doc 05).

## 3. Design decisions to settle before code

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D-4A | KnowledgeId typing | (a) closed string union `type KnowledgeId = …` + def field typed `KnowledgeId`; (b) `string[]` + sanitizer registry set | **(b)** — registry set + runtime strip keeps saves forward-compatible and avoids def-type churn in a field LR-3 also touches |
| D-4B | TeachingState shape | (a) keep `{ known: string[] }` (documented divergence from doc 05); (b) add taughtBy/taughtDay → v12 | **(a)** for LR-4; record the divergence in the decision register (doc 21 convention) |
| D-4C | LR-4 timing vs LR-3 | (a) LR-4 before LR-3 merges (mechanics-only against the nook def; content topic is Nora-scoped); (b) after LR-3 | Either is safe (disjoint files); **(a)** is permissible iff the LR-3 owner agrees the golden regen tail may interleave — otherwise (b) |
| D-4D | Post-teaching repeat completions | (a) block repeat invitations entirely; (b) allow repeat visits ("cozy moment + smaller bump") with knowledge-grant idempotent | doc 05 §5.6 sketches (b); recommendation: **(b)** with NO second memory and NO second grant (guards already ensure it) — but explicitly zero new reward delta |

## 4. Target architecture (single-owner map)

- **Knowledge grant writer**: `completeSharedActivity` ONLY (one added block, after the `already_completed` guard, before affinity application — ordering: refusal guards → grant → rewards → memory → event → archive → clear).
- **Readers**: `requiresTeachingKnown` condition (existing), the new topic content, optional future UI.
- **Sanitizer**: `sanitizeLivingRelationships` teaching block gains the registry strip (with warning).
- **Files touched**: `activities.ts` (grant + registry export), `migrations.ts` (strip), `dialogue/…` (one topic module + aggregator tail + golden), `tests`. **Untouched**: `invitations.ts`, `occupancy.ts`, `simulation.ts`, `storage.ts` schema, `types.ts` WorldState (if D-4B (a)).

## 5. Acceptance test plan (red-test-first, per doc 15 §5.3)

Inherit doc 16 §8 verbatim plus:

| ID | Scenario | Expected |
|---|---|---|
| LR4-01 | Complete `share_featured_reading` (fresh teaching) | `teaching.known === ['nora_featured_reading']`; grant happens exactly once; memory + rewards unchanged vs LR-2 baseline |
| LR4-02 | Decline / expire paths | `teaching.known` stays empty (already architecturally true; pinned) |
| LR4-03 | Duplicate completion / pre-seeded memory | strict no-op incl. no second grant (LR2-07 analog extended) |
| LR4-04 | Dialogue: `requiresTeachingKnown` topic | Surfaces only after grant; hidden before; golden regenerated with tail-append justification |
| LR4-05 | Sanitizer: save with unknown id `'phantom_knowledge'` | id stripped WITH warning; valid ids preserved; no schema bump (v11 load) |
| LR4-06 | Persistence | round-trip incl. mid-visit; day-advance clear contract; tick/load parity pins green; save-revision fingerprint changes on grant |
| LR4-07 | Regression | full suite green; LR-1/LR-2 batteries unmodified; LR-3-scoped guard (if LR-3 landed): bakery completions leave `teaching.known` empty |

## 6. Prerequisites

- None external: teaching slice, condition, def field, sanitizer hook all exist. The SF-2 capability rows and SF-4 band rules are consumer-safe by construction (teaching never gates invitations; teaching topics are content, not boosts).
- Coordinate the golden-snapshot tail with the LR-3 owner if both add topics (append order is contractual — doc 22 §5).
