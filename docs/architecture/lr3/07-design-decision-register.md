# LR-3 Design Decision Register (D1–D8)

- **Date**: 2026-11-22
- **Status**: Phase Five-adjacent deliverable (initiative §6). Decision **record** — recommendations only; nothing herein silently converts a recommendation into an approved decision. Docs-only.
- **Source of the decisions**: `03-lr3-scope-and-acceptance.md` §2 (D1–D8, restated verbatim below — not invented or replaced). Two emergent decisions (D9, D10) discovered by Phase Two/Three evidence are appended, explicitly marked as additions, not replacements.
- **Convention**: follows doc 21 (LR-1 decision record) discipline: evidence → options → recommendation → consequences → test → approval status.
- **Approval vocabulary**: `ENGINEERING` (decidable from source evidence + technical correctness; reviewer-approved) · `USER` (materially affects the experience; project-owner approval requested) · `BLOCKING` (must resolve before feature code).

---

## D1 — Venue scope confirmation: LR-3 = Clara/bakery only

- **Decision (restated from doc 03 §2)**: "(a) bakery only (doc 14 §10 — recommended); (b) bakery + greenhouse family (HANDOVER 'LR-3+' umbrella)."
- **Evidence**: doc 14 §10 + §1 authority clause ("This document supersedes conflicting rules in 03–12"); doc 15 §3 LR-3 battery names bakery only; greenhouse has no seat spots and no occupant rig path (`greenhouse.ts` — no `*_SEAT_SPOTS` analog used by LR-2; doc 01 §7.1); HANDOVER.md:5's "LR-3+" is an umbrella phrase, not a scope definition.
- **Alternatives**: (a) bakery only; (b) bakery + Mina/Sunbeam Greenhouse simultaneously.
- **Trade-offs**: (a) is exactly the doc-14 scope, one venue of proven pattern, minimal surface; (b) doubles occupancy work (greenhouse lacks anchors/rig), blurs the second-interior architectural test, and expands a milestone whose point is proving reuse.
- **Recommendation**: **(a) bakery only.**
- **Gameplay consequence**: one new hosted morning ritual; greenhouse stays a growing sim.
- **Architectural consequence**: the F-ENTER-1 shared-enter-path test runs with exactly two venues — sufficient evidence, no over-generalization.
- **Test required**: none beyond scope (out-of-scope assertions: no greenhouse occupancy writes — covered implicitly by suite green).
- **Approval**: `USER` (owner confirmation of scope reading, per doc 01 §7 ambiguity 1) — but **not BLOCKING**: the authority chain (doc 14) is decisive; proceeding on (a) cannot be wrong under the spec of record.

## D2 — `share_morning_pastry` def parameters + Clara's offer-window cap

- **Decision (restated)**: "duration, `minTier`/`minAffinity`, memory id/title, `npcMemoryTag`, `stationId`, `seatPos`/`seatFacing`; Clara's offer-window cap computed from her schedule. Superseded doc 06 sketch (Clara / bakery table / 8 min / `clara_tea_and_crumb`) is indicative only; D-17 cap must be computed from Clara's contiguous home phases."
- **Evidence** (each value verified, doc 05 §6.1): seat data `bakery.ts:297-308`; Nora's def thresholds `activities.ts:61-63`; window computation `computeOfferWindow` `invitations.ts:127-152` — Clara's morning cap resolves to **719** via the away-afternoon rule (afternoon slot 8.938 m > 6.0 m), i.e. computed by the existing function, not copied; reward deltas bound by doc 15 §3.2.5; id/title/tag conventions from Nora's def.
- **Alternatives**: copy Nora's constants wholesale (rejected: D-17 forbids copying; here the *function* produces the same cap from different schedule facts, which satisfies the policy); invent new thresholds (no evidence); the superseded 8-minute sketch (rejected: duration semantics in the as-built system are the *window*, not a minigame length — 180 matches Nora's window semantics and the 719 cap dominates anyway).
- **Trade-offs**: friendly/45 floor keeps Clara's invitation reachable at the same progression point as Nora's (predictable pacing); tighter floors would add grinding pressure (forbidden by doc 15:106).
- **Recommendation**: the full def as specified in doc 05 §6.1 (stationId/seat/facing from the pinned seat spot; `minTier 'friendly'`, `minAffinity 45`; window 180; `mem_lr_clara_morning_pastry`; tag `shared_morning_pastry`; no `knowledgeGranted`).
- **Gameplay consequence**: Clara's invite lands at friendly; window covers the whole morning.
- **Architectural consequence**: none beyond the def; constants are seat-spot-imported, not re-typed.
- **Test required**: LR3-01/11/12 (window parametric + spacing), LR3-44 (deltas).
- **Approval**: `ENGINEERING` for the def values; **the def's `offerPhases: ['morning']` sub-item is `USER` (see D10)**. Not BLOCKING except via D10's own flag.

## D3 — Occupant anchor station: café chair vs new table station

- **Decision (restated)**: "(a) café chair (`bakery_seat_cafe_west`, the only as-built seat) — reuses `BAKERY_SEAT_SPOTS`, conflicts with solo sit (needs suppression); (b) new table station — no sit-clash but new seat data + walkability evidence. Doc 13:91 documents the clash; doc 06 [superseded] says 'bakery table'."
- **Evidence**: `BAKERY_SEAT_SPOTS` is a single pinned record with approach/facing/height (`bakery.ts:297-308`, exercised by `bakery.test.ts`); the nook suppresses sit on the claimed station with a two-line guard (`actions.ts:979-988`); the sit-clash doc 13:91 feared becomes the *exclusivity proof itself* (the claim must be visible and refusable); the east chair is decorative with no seat data (`bakeryInterior.ts:639-643`).
- **Alternatives**: (a) as-built chair + suppression; (b) new fictional station id + seat data + walkability validation; (c) counter station (Clara behind the counter).
- **Trade-offs**: (b) avoids a refusal line but invents geometry, splits station identity from the only real seat, and adds walkability risk for zero gameplay gain; (c) would put the shared pastry on the same fixture as the solo loaf share, muddying S3's no-mutation story.
- **Recommendation**: **(a)** — `stationId = 'bakery_seat_cafe_west'`, player sit refused with a Clara-voiced line while claimed; the *card anchor* is a new `bakery_cafe_table` interactable (doc 05 §6.3) mirroring the nook-chair branch.
- **Gameplay consequence**: the picture matches the fiction — she saved you the seat across the table.
- **Architectural consequence**: suppression guard can match the seat id directly (nook precedent); no new seat geometry.
- **Test required**: LR3-23/24 (claim + sit refusal), LR3-28 (notes shelf unaffected).
- **Approval**: `ENGINEERING`.

## D4 — Clara offer discoverability gate

- **Decision (restated)**: "(a) tier/affinity only (generic gates already exist); (b) a designed story gate like Nora's postcard. Nora's gate is a documented designed pattern (recovery doc 05 §5); Clara has the bellQuest/orchard arcs as candidates."
- **Evidence**: generic gates fully implemented and host-generic (`canOfferInvitation`, LR1-08/09/10); Clara already participates in four storylines + ten dialogue topics (doc 04 §1.4); a story gate would require new storyline/flag content — outside the LR-3 authorization boundary ("no production gameplay implementation" and doc 03 §1 out-of-scope list).
- **Alternatives**: (a) generic; (b) designed gate (e.g., completion of `side_herb_loaf` as a prerequisite flag).
- **Trade-offs**: (b) adds narrative weight and a discovery beat but costs new content, new state dependencies, and delays LR-3; (a) keeps the milestone content-scale and lets Clara's existing arcs supply warmth.
- **Recommendation**: **(a)** for LR-3. If the owner wants (b), it is a *content amendment* that can be added later without touching architecture (the gate would ride `requiresFlag` in the offer topic condition — the dialogue layer already supports it).
- **Gameplay consequence**: friendship-based discovery, consistent with "busy café tables" Clara who invites neighbors herself.
- **Architectural consequence**: none.
- **Test required**: LR3-50 (gate matrix), LR3-49 (surface within two interactions).
- **Approval**: `USER` (visibility of the invitation is experience-facing) — **not BLOCKING**; (a) is the no-regression default and (b) remains available as a later content add.

## D5 — Enter-path shape: shared helper vs duplicate

- **Decision (restated)**: "(a) duplicate the nook block in `enterBakeryAction` vs (b) extract a shared enter-reconcile helper adopted by both venues. Shared helper is the reliability branch's recorded revisit direction for F-ENTER-1; duplication is the pattern it says to avoid. Depends on the reliability gate (doc 03 §5); helper is recommended either way."
- **Evidence**: full F-ENTER-1 investigation in doc 05 §9 (verbatim finding, first-hand asymmetry verification, branch implemented no correction); helper mechanics + no-cycle placement doc 05 §5; observable-behavior guarantee for the nook path.
- **Alternatives**: (a) duplicate; (b) shared helper in `invitations.ts`; (c) data-driven enter registry; (d) lifecycle layer — all four compared against eight criteria in doc 05 §10.
- **Trade-offs**: (a) is faster today and drifts tomorrow (third copy at the next venue); (b) costs one refactor of `enterNookAction` (observable behavior pinned identical) and buys single-ownership + next-venue content-scale; (c)/(d) over-generalize two venues.
- **Recommendation**: **(b)**.
- **Gameplay consequence**: none observable (identical toasts); future venues get the same beat for free.
- **Architectural consequence**: one new pure function; enter reducers shrink; F-ENTER-1 closed in design.
- **Test required**: LR3-13–21 (bakery through the helper), nook suite green unmodified, LRTL analogs (LR3-19/72).
- **Approval**: `ENGINEERING`. **Not BLOCKING** — the helper works with or without the reliability merge (gate-conditional SR-7 handled at D7/§10 of doc 05).

## D6 — Venue-derived accept toast (fix `actions.ts:901` hardcode)

- **Decision (restated)**: "Derive from `getSharedActivityDef(activityId).location` / `RESIDENTS[host].homeName`. One-line architecture fix; keeps both venues truthful."
- **Evidence**: hardcode verified — "Invitation accepted — meet ${RESIDENTS[residentId].name} inside Linden Book Nook." (`actions.ts:901`) would fire for a Clara acceptance; `homeName` is already the generic venue label used by the journal card (`journal.ts:1173`).
- **Alternatives**: per-activity toast template def field (more data, no gain — `homeName` *is* the venue label); leave hardcoded (Clara's accept would lie — unacceptable, S6).
- **Trade-offs**: none material; the derivation is a strict improvement and touches no logic.
- **Recommendation**: derive: `Invitation accepted — meet ${name} inside ${RESIDENTS[hostId].homeName ?? 'their home'}.` (fallback preserved for safety). Nora's toast string is byte-identical after the change (homeName === 'Linden Book Nook').
- **Gameplay consequence**: truthful legibility for both hosts (S6).
- **Architectural consequence**: one line; kills a venue-coupled literal.
- **Test required**: LR3-45's card pins + a toast assertion in the LR3 block; nook toast regression (existing suite).
- **Approval**: `ENGINEERING`.

## D7 — Persistence: registry-only (no schema bump) vs new persisted state (v12)

- **Decision (restated)**: "Registry-only preferred; any genuinely new field forces `migrateV11ToV12` + sanitizer/revision/clone updates + GUARD fixtures. Doc 02 §3; doc 14 §9 policy."
- **Evidence**: verified that the entire LR-3 design expresses through existing v11 state: invitation record + `lastOfferDayByHost['clara']` (existing maps), single occupancy slot (existing), `activeActivity` (existing), activity def (code, not save data), journal memory (existing collection). No new field emerged from Phases Two–Four (doc 04 §4.5; doc 05 §6). Sanitizer already validates Clara invites generically (`SHARED_ACTIVITIES[activityId].hostId === hostId`, `migrations.ts:1434`).
- **Alternatives**: (a) registry-only (no migration); (b) new persisted state (e.g., persisted per-host session state, station-claim table).
- **Trade-offs**: (b) would buy nothing the occupancy slot doesn't already own, and costs the full migration chain (v12 function, sanitizer domain rules, save-revision coverage, pure-wrapper clone, GUARD fixtures) plus cross-branch merge risk with the reliability branch's migration surface (+263 lines there).
- **Recommendation**: **(a) registry-only, no schema bump.** **Stop-rule (binding, from doc 03 §5):** if implementation discovers genuinely necessary new persisted state, work STOPS and the migration implications go to the owner for approval before any schema change.
- **Gameplay consequence**: none; saves stay compatible both directions at v11.
- **Architectural consequence**: migrations/storage/simulation remain untouched — the reliability branch's merge surface stays clean.
- **Test required**: LR3-33/66–73 (round-trips, parity, schema-policy) — all pass with zero migration tests needed.
- **Approval**: `ENGINEERING` (with the binding stop-rule). Not BLOCKING.

## D8 — Bakery occupant scene rig: parameterized vs second hardcode

- **Decision (restated)**: "(a) parameterize the existing nook occupant-rig pattern (one venue-agnostic occupant rig feeding on `occupancy`) vs (b) a second hardcode. Evidence tilt: parameterized path recommended (`NeighborhoodCanvas.tsx:922-939, 2062-2109`)."
- **Evidence**: three Nora-hardcoded blocks verified (rig :922-939; click routing :1454-1472 incl. `NOOK_OCCUPANT_APPROACH_POS` and the `share_featured_reading` label switch; per-frame sync :2062-2109); single occupant slot guarantees at most one active rig per interior; Clara's rig assets exist.
- **Alternatives**: (b) copy the three blocks for the bakery (three more Nora-hardcode analogs — four total hardcoded surfaces next venue); (a) loop over (interior → rig) pairs with def-driven approach/labels.
- **Trade-offs**: (a) touches a 2700-line scene file's three regions and must keep nook behavior identical (manual QA + existing tests); (b) is faster once and compounds drift forever.
- **Recommendation**: **(a)**, scoped to exactly the three regions (doc 05 §8) — not a broader scene refactor.
- **Gameplay consequence**: Clara visibly seated at the café corner, look-at tracking, ring/quest-pip behavior identical to Nora's.
- **Architectural consequence**: the occupant presentation is data-driven; next venue registers a rig, writes no math.
- **Test required**: existing scene tests green; LR3-63 manual QA; nook rig QA re-run.
- **Approval**: `ENGINEERING`.

---

## Emergent decisions (Phase Two/Three evidence — additions, not replacements)

## D9 — Venue-aware completion text (doc 05 §6.2; doc 04 F1)

- **Finding**: `completeSharedActivity`'s journal memory + world-event summaries hardcode the featured book and "Linden Book Nook" (`activities.ts:223/231/281`) — a bakery completion would journal factually wrong text. Doc 02's "no change needed" claim holds for mechanics only.
- **Options**: (i) per-def `summaryCompose` field with a default to the current composition (recommended); (ii) branch on hostId inside the transaction (hardcoding a second venue into a "generic" function — the exact anti-pattern); (iii) move summaries into dialogue (changes where the text lives, breaks journal-driven tests).
- **Recommendation**: (i). Nora's strings byte-identical; Clara's bake-roster-aware.
- **Consequences**: truthful journal/world events for every future venue; one def field.
- **Test**: LR3-45/46 (venue-true text, no book leak) + Nora text regression.
- **Approval**: `ENGINEERING`.

## D10 — Morning-only offer phase (`offerPhases` def field; doc 05 §7.2)

- **Finding**: without a phase constraint, Clara's golden (5.533 m) and dusk (0.0 m) slots pass the generic gate — a "morning pastry" offered at 8:30 PM with a live window into 1260 (doc 04 §1.2). Doc 15:90 requires only afternoon suppression; morning-only is a *tightening*.
- **Options**: (i) add optional data-driven `offerPhases` to the def + one check in `canOfferInvitation` (recommended — generic, Nora untouched); (ii) restrict via dialogue conditions only (fragile: eligibility is engine-level, the writer would still accept offers from other surfaces); (iii) accept golden/dusk offers (thematically incoherent for the activity id/trait/roster grounding).
- **Recommendation**: (i), `['morning']` for Clara.
- **Gameplay consequence (approval-relevant)**: the invitation is discoverable only on mornings — a visible narrowing vs the discovery baseline. Mitigation: the 719 cap already confined completion to the morning; morning-only makes offer and completion coherent, and Clara's morningLark 0.9 makes the pacing natural.
- **Architectural consequence**: one optional field + one gate line + reason `offer_phase_closed`; LR1 suite untouched.
- **Test**: LR3-02, LR3-50, LR3-86 (Nora's field-absence pass).
- **Approval**: **`USER` — gameplay-facing restriction; approval requested before implementation. Not requested for design approval itself.**

## Approval summary

| Decision | Class | Blocking? | Asked of |
|---|---|---|---|
| D1 venue scope | USER | No (authority chain decisive) | Owner confirmation |
| D2 def values | ENGINEERING | No | Review |
| D2/offerPhases (→ D10) | USER | **Yes, before feature code** | Owner |
| D3 café chair | ENGINEERING | No | Review |
| D4 discoverability | USER | No (default (a) is no-regression) | Owner (may defer) |
| D5 shared helper | ENGINEERING | No | Review |
| D6 toast derivation | ENGINEERING | No | Review |
| D7 registry-only + stop-rule | ENGINEERING (stop-rule binding) | No | Review |
| D8 rig parameterization | ENGINEERING | No | Review |
| D9 completion text | ENGINEERING | No | Review |
| Reliability gate path (a)/(b)/(c) (doc 03 §5) | USER | **Yes, before feature code** | Owner |
