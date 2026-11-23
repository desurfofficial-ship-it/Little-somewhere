# Social Foundation — Post-Integration Adversarial Audit
# 09 — LR-3 Readiness Revalidation

**Authoritative LR-3 (unchanged):** Hearth & Crumb Bakery interior occupancy + shared activity `share_morning_pastry`, hosted by Clara. User-approved decision D10: `offerPhases: ['morning']` (approval of the design decision — **not** authorization to implement LR-3 during this audit).

## 1. Reserved-seam verification (§11.1) — all ten seams byte-untouched

`git diff e3f86b8 8b715fc` returns 0 lines for every seam file:

| Seam | Location at HEAD | SF-touched? |
|---|---|---|
| Activity registry | `activities.ts:31-72` (`SHARED_ACTIVITIES`, single def `share_featured_reading`/nora), `completeSharedActivity` :161-336 | UNTOUCHED |
| Enter-hook / shared enter-reconcile | `enterNookAction` (actions.ts:2960-3034; expiry + live-check + occupant set, venue condition hardcoded :2989); `enterBakeryAction` :2664-2688 (reconcile-free); `reconcileInvitedInteriorEntry` **does not exist in src yet** (doc-comment only, invitationFramework.ts:47-49) | UNTOUCHED |
| Station guards | real surfaces: `occupancy.ts:19,79-86`, `actions.ts:3071-3093`, `bookNook.ts:366-395`, `App.tsx:370-381`, registry-driven sanitizer `migrations.ts:1772-1786`, `types.ts:621` (note: the brief's "station guards in worldMap.ts" is mislocated — `worldMap.ts` has zero station logic; audit correction) | UNTOUCHED |
| Clara dialogue quartet | `dialogue/invitations/` = `index.ts` + `nora.ts` only; **`clara.ts` absent** (reserved) | UNTOUCHED |
| Venue-derived acceptance feedback | accept toast hardcode `actions.ts:901` ("inside Linden Book Nook"); arrival toast :3003; journal fallback `journal.ts:1202` | UNTOUCHED (pre-existing hardcode; LR-3 D6 owns it) |
| Activity-specific summary composition | `activities.ts:231/281/214` (Book-Nook-hardcoded; `summaryCompose` reserved) | UNTOUCHED |
| Scene click routing | `src/scene/**` 0 diffs; occupant rig/routing parameterization owned by LR-3 D8 | UNTOUCHED |
| Invitation offer phases | `offerPhases`/`offer_phase_closed` — **zero src hits** (reserved); `canOfferInvitation` (invitations.ts:159-199) has no phase gate | UNTOUCHED |
| Occupancy semantics | writers `occupancy.ts:29-68` + enter/exit reducers; clearing in chassis writers; readers generic | UNTOUCHED |
| Completion behavior | `completeSharedActivity` + wiring | UNTOUCHED |

## 2. Reserved-name scan (§11.4)

`share_morning_pastry`, `reconcileInvitedInteriorEntry`, `offer_phase_closed`, `offerPhases`, `clara` (as a binding), `station`, `mem_lr_clara_morning_pastry`, `shared_morning_pastry`, `bakery_cafe_table`: **zero code-level collisions** across the five new SF modules — doc-comment boundary mentions only, plus one legitimate pre-existing state read (`emergentStories.ts:290` reads the existing `bakeryState.loavesShared` counter for the community-pulse seed; not a reserved identifier). The reservation map is honored; doc 04's mechanical claim independently reproduced.

## 3. Registry/capability constraint check (D10 readiness)

- **`offerPhases` does not exist anywhere in src** (no field in `SharedActivityDef`, no gate in `canOfferInvitation`). Independently recomputed Clara schedule distances (residents.ts:58-87): morning 1.02 m (pass), afternoon 8.94 m (block), **golden 5.53 m (pass), dusk 0.0 m (pass)** — matching LR-3 doc 05 §7.1. Consequence: if the bakery def landed **without** the phase gate, morning-only offers would silently be violated in golden/dusk through `canOfferInvitation`, `describeInvitationCapabilities`, and every `requiresInvitationEligible` dialogue topic. Sequencing constraint (P2, non-blocking): the field and the gate must land **atomically, in the chassis** (not the framework — SF-D7 forbids re-implementing the gate in the capability layer), exactly as LR-3 doc 05 §7.2 already specifies.
- `cancelActiveInvitation` is **host-agnostic** (reads only `world.invitations.active`; zero host-specific logic) — works for any future registry host; pinned by SF2-05..10.
- Reason map: covers every chassis/completion reason emitted today; `offer_phase_closed` correctly absent (reserved); graceful fallback prevents crashes; adding one map key is the sanctioned extension.
- Engine echo branch is per-topic-id (`dialogueEngine.ts:1070-1077` hardcodes `shared_featured_reading`); LR-3 adds its own topic + branch + golden regen (**expected 86 → 90** — doc 05's "85 → 89" predates SF).
- Golden-snapshot tail pin (SF4-07) constrains the Clara quartet's insertion point: must spread via `dialogue/invitations/index.ts` (mid-registry), never appended after `REFLECTION_TOPICS`.

## 4. F-ENTER-1 (§11.2) — entry-reconciliation asymmetry

Still open, still by-design deferred: only `enterNookAction` reconciles (expiry + live-check + occupant set); `enterBakeryAction`/`exitBakeryAction` do neither; companion asymmetry — only `exitNookAction` clears occupancy/`activeActivity`. Finding of record: `systemic-reliability/11-deferred-findings.md:23-27` ("LR-3 design record on PR #8 owns that investigation"). The SF diff touches **no reducer on the entry path** (actions.ts 0-diff). The previously proposed shared helper (`reconcileInvitedInteriorEntry` in `invitations.ts`, two-venue adoption) **remains exactly appropriate against current main**: `enterNookAction`'s block is still byte-shaped as the helper contract models it; every input the helper composes (`expireInvitationsAt`, `isInvitationLive`, `isHostAvailableForActivity`, `setOccupant`) is unchanged. A smaller/elegant alternative was not identified; two-venue adoption remains the right scope. **Not implemented here, per the audit boundary.**

## 5. LR-3 regression matrix (§11.3) — Book Nook + Nora flow vs the Social Foundation

| Battery | Command | Result |
|---|---|---|
| Full suite | `npm test` | 595/595 |
| Core LR-1/LR-2 | invitations + activities + invitationFramework + occupancy test files | 48/48 |
| SF + journal + dialogue + persistence batteries | 10 test files | 156/156 |

Interaction reasoning (code-verified): cancel → story seeds (open_visit requires accepted+live — cancel kills it: coherent zero-FOMO); `deriveSharedHistory` filters `outcome === 'completed'` only — a cancelled row (`expired` + `player_cancelled`) counts **never** as a completed visit, so tradition seeds and chapter lines cannot be corrupted; `thank_you_owed` reads keepsake state, not history (no corruption path); cancel → dialogue (quartet topics require active invitation — post-cancel silence; same-day re-offer blocked by the preserved spacing stamp); cancel → journal (active-invitation card derives from live state; history labels render "Stepped back"); sanitizer round-trip pinned. **No side effects found.**

## 6. PR #7 / #8 revalidation (brief §21 step 3)

Both PRs remain open, unmerged, untouched by this audit. Their content (LR-3 Phase One discovery; Phases Two-Five design, stacked on #7) remains consistent with current main: every seam they describe is byte-present; F-ENTER-1 is unchanged; the D10 record on the `docs/lr3-design` branch still reads "approval requested" — main's decision record (`08-lr3-d10-owner-decision-record.md` §4) requires the approval to be applied to the branch register when LR-3 implementation opens (bookkeeping item for the LR-3 owner; not a blocker). **No merge action taken or recommended without explicit authorization.**

## 7. LR-3 dependency map (touchpoint × SF effect)

| LR-3 touchpoint | SF effect | Note |
|---|---|---|
| `SHARED_ACTIVITIES` def + def fields (`offerPhases`/`arrivalLine`/`summaryCompose`) | UNTOUCHED | sanctioned extension |
| `canOfferInvitation` phase gate + `offer_phase_closed` | CONSTRAINED (sequencing) | atomic with the def, in the chassis |
| `reconcileInvitedInteriorEntry` + bakery enter/exit adoption | UNTOUCHED | adopt, don't fork (doc 22 §8.2) |
| Station `bakery_seat_cafe_west` + guards | UNTOUCHED | occupancy generic; sanitizer registry-driven |
| Occupancy set/clear/skip/serialize | UNTOUCHED | location-generic |
| Clara quartet + aggregator | CONSTRAINED (insertion point) | before the SF-4 tail; golden 86→90 |
| Completion summary (D9) | CONSTRAINED (truthfulness) | venue-hardcoded completion text would journal Book-Nook facts for a bakery visit — owned by LR-3 D9 |
| Accept toast derivation (D6) | UNTOUCHED | pre-existing hardcode; LR-3 D6 fixes |
| Scene occupant rig/routing (D8) | UNTOUCHED | 0 diffs |
| Emergent seeds / chapter / ledger / cancellation for Clara | UNTOUCHED — **auto-pickup** | registry titles; host-agnostic cancel; completed-only filters verified |
| Engine echo branch for `shared_morning_pastry` | CONSTRAINED (additive) | new topic + branch + golden regen; firsthand-filter recommendation from doc 06 applies |

## 8. Readiness verdict (§11.5)

**READY FOR IMPLEMENTATION.** Blocking conditions: **none.** The two P2 items above are sequencing constraints internal to LR-3's own approved design documents, not incompatibilities introduced by the Social Foundation. Cross-references: the six P2 Social Foundation findings (R-01…R-06) carry recommended fixes (doc 13); none of them is activated by LR-3's reserved scope except the echo firsthand filter, which should land with or before LR-3's second shared activity. LR-3 production implementation awaits explicit owner authorization.
