# LR-3 Gameplay & Systems Research

- **Date**: 2026-11-22 (reconciled 2026-11-22, post-integration)
- **Status**: Phase Two deliverable (initiative §2 + §3 research; special investigation F-ENTER-1 lands in doc 05 §9). Docs-only; contains no code changes. Carries 2026-11-22 reconciliation updates marked **[Reconciled]**.
- **Verification basis**: every fact below was re-verified first-hand against `origin/main` @ `962fb07` on 2026-11-22 (Phase Zero re-confirmation: main `962fb07`, **447/447 tests, `tsc` clean**; discovery branch `docs/lr3-discovery` @ `6fd59c7`; PR #7 open/draft; PR #3 open/draft untouched; `feat/systemic-reliability` @ `b71bb3c` local-only, **459/459**). All `file:line` citations are to the `962fb07` tree unless marked **[Reconciled `a80a220`]**. Reconciliation re-verification against main `a80a220` (528/528, first-hand): §1's characterization/venue/schedule facts are **byte-stable** (every cited file except `journal.ts`/`simulation.ts`/`storage.ts`/`migrations.ts`/`storylines.ts`/`NeighborhoodCanvas.tsx` is unchanged between the two baselines); §10.4–§10.6 record the deltas.
- **Authority basis**: extends `01-authoritative-milestone-discovery.md` (doc 01) and `03-lr3-scope-and-acceptance.md` (doc 03). Docs 01–03 conclusions are preserved verbatim; §10 of this document records the Phase Two evidence that amends two of doc 02's claims.

---

## 1. Clara — established characterization (source-verified)

### 1.1 Identity and personality

`residents.ts:29-88` (all values read from source):

| Field | Value | Design use |
|---|---|---|
| `role` | Sourdough Baker | The activity is her craft's morning payoff |
| `homeName` | Hearth & Crumb Bakery | Venue label for toasts/journal (already registry-generic, `journal.ts:1173`) |
| `personality` | "Warm-hearted, proud, secretly misses the old morning bell." | The wistfulness is the emotional hook the pastry moment can gently answer |
| `favoriteThing` | "Crusty rosemary loaves and busy café tables" | Exactly the two props the activity touches (bake + café table) |
| `likedItems` | `rosemary_basket`, `tea_tray` | Tea is already part of her ritual vocabulary (café table teacup, `bakeryInterior.ts:605-610`) |
| `traits.sociability` | 0.72 | High — she initiates; the offer must feel like her idea (it is: dialogue offer topic) |
| `traits.morningLark` | 0.9 | Strongest morning affinity of all residents — grounds a **morning**-anchored activity |
| `traits.preferredZones` | bakery, square, gazebo | Morning pastry at the bakery is in-character |
| `traits.rainBehavior` | `shelter_home` | Rainy mornings keep her on the porch — offers stay plausible in rain |
| `traits.greetingDistance` | 3.6 | Longest of the neighborhood; she waves neighbors in early |

Doc 14 §6.2 already flagged "Clara high sociability (0.72), often in square/encounters" as the bakery's host-schedule pressure — confirmed below in §4.4.

### 1.2 Clara's daily schedule (canonical, `residents.ts:58-87`)

| Phase | Slot | Target | Distance to `homePos` (-9.0, -6.4) | Availability gate (`invitations.ts:59-79`, radius 6.0 m) |
|---|---|---|---|---|
| morning (360–689) | Bakery Porch | (-8.0, -6.2) | **1.020 m** | **Eligible** |
| afternoon (690–959) | Fountain Plaza | (-3.2, 0.4) | **8.938 m** | **Blocked** |
| golden (960–1109) | Gazebo Walk | (-3.5, -5.8) | **5.533 m** | **Eligible** (pre-reconciliation) |
| dusk (1110–1290) | Bakery Steps | (-9.0, -6.4) | **0.000 m** | **Eligible** |

Amendment to doc 01 §5: doc 01 recorded the afternoon slot as "≈6.9 m"; the computed distance is **8.938 m** (`distance2D` = Euclidean, `worldMap.ts:451-455`). The conclusion (afternoon auto-blocks) is unchanged; the number is corrected here as primary-source evidence.

Two additional facts doc 01 did not record:

1. **Golden and dusk slots pass the generic gate** (5.533 m and 0.0 m ≤ 6.0 m). `canOfferInvitation` would permit a "morning pastry" offer at 5 PM or 9 PM. That is thematically incoherent for an activity whose identifier, dialogue, and rewards are all morning-anchored — see §5.2 (decision D2/offer-phase gate).
2. **The availability gate reads the raw schedule, not the reconciled schedule.** `isHostAvailableForActivity` reads `RESIDENTS[hostId].schedule[phase]` directly (`invitations.ts:67`), *not* `getResidentScheduleSlot` (`residents.ts:632-657`). After `claraArthurReconciled`, the simulation places golden-hour Clara at Gazebo Steps (-1.1, -6.1; 7.906 m — would be blocked), but the gate still sees the base schedule (5.533 m — eligible). The gate and the sim position diverge in that one window. Clara's **morning** slot has no reconciled override, so a morning-scoped offer is immune to this divergence (evidence for D2).

### 1.3 Clara's weighted behaviors (actual exterior position, `residents.ts:680-751`)

`selectActivityForResident` (`simulation.ts:172-280` [Reconciled `a80a220`: `:172-339`]) picks Clara's real position per 45-minute block from the anchor plus weighted extras. Two extras run in **morning**: `clara_herb_errand` (Sunbeam Greenhouse, 19.15 m from home, weight 0.78) and `clara_orchard_apples` (Fern Hollow Orchard, weight 0.74). Consequence: **the availability gate is schedule-based, not position-based** — Clara can stand at the greenhouse while the gate reports "available" (her schedule slot is the porch). This is the as-built LR-2 semantic for Nora too (Nora simply has no morning extras, so the divergence never showed). LR-3 treats it as a feature to be *voiced*, not a bug to be re-architected: the offer dialogue acknowledges she will finish up and head inside (Nora's pattern: "Then I'll head inside right ahead of you", `dialogue/invitations/nora.ts:149`). Re-positioning the gate to actual coordinates would change the LR-1 predicate, touch pinned tests (LR1-10's distant-slot semantics), and violate the restraint mandate — rejected (doc 07 D4 note; doc 05 §7).

**[Reconciled `a80a220`]** Two further Clara extras the Phase Two census missed (both verified on the integrated tree; they refine, not change, the divergence picture): `clara_rain_oven` (weight 1.6, rain-gated porch extra — on rainy mornings she stays at the porch, *reducing* morning divergence) and `clara_cafe_tables` (weight 1.3, **afternoon + golden** blocks, gated on the `claraArthurReconciled` flag — "Bakery Café Tables" at (-7.2, -5.4), ≈ 2.059 m from `homePos`, inside the 6 m gate; moot for offers under morning-only D10).

### 1.4 Clara's relationships and arcs (why she invites)

- **NPC–NPC**: `BASELINE_NPC_BONDS` includes the clara↔arthur estranged bond; `reconcileClaraAndArthurRelation` (`relationships.ts:405`) upgrades it bilaterally when `flags.claraArthurReconciled` flips (`actions.ts:373-376`). The reconciliation arc is her established emotional storyline; the golden-hour gazebo beat (`residents.ts:638-646`) shows her post-arc self: "Sharing warm sourdough beside Arthur under the bell".
- **Storylines**: lead resident of `side_herb_loaf` ("Seasonal Herb & Hearth" — herb loaves from *her* stone oven shared across the lane, `storylines.ts:70-99`), lead of `side_orchard_gathering` (`storylines.ts:251-274`), and participant in `side_pip_zine` (lead/participant lists at `storylines.ts:26/:41`). **[Reconciled `a80a220`: the original text here cited `conflict_plaza_lanterns` (`storylines.ts:41`) and "the main Silent Gazebo Bell storyline (`storylines.ts:26`)" — both citations were wrong at source: `:41` is `side_pip_zine`'s `['toby','clara']` participant pair and `:26` is `side_pip_zine`'s lead list; `conflict_plaza_lanterns` (`storylines.ts:199`) names no Clara, and the Silent Gazebo Bell narrative lives in `actions.ts:1707`/`journal.ts:1212`/`bellQuest.ts` with Clara's genuine bell-arc hook being the `quest_clara_rift` dialogue/bellQuest content (`bellQuest.ts:278-282`).]**
- **Everyday dialogue**: ten registry topics already (`dialogue-topics-golden.json`, residentId `clara`: quest_clara_rift, side_clara_zine_kitchen, side_clara_herbloaf_2, side_clara_orchard_tart, gossip_clara_mina_loaves, daily_clara_crust, daily_clara_tables, everyday_hearth_aroma, side_clara_bakery_kitchen, daily_clara_bakery_checkin) — a Clara invitation quartet joins a dense, established dialogue web, not a bare character.
- **Venue rituals she already owns** (the shared pastry must sit beside, not on top of, these): `checkMorningBakeAction` (oven reveal, +8m, `actions.ts:2740-2777`), `helpKneadDoughAction` (knead, +12m, sets `kneadedDay`/`kneadingSessions`, doubles the same-day share, `actions.ts:2783-2822`), `shareMorningLoafAction` (solo loaf share, +6m, sets `loafSharedDay`/`loavesShared`, `actions.ts:2828-2885`), `readBakeryNotesAction` (notes shelf, `actions.ts:2888-2934`).

### 1.5 Clara's behavioral contract across the invitation lifecycle

Every outcome below resolves through an **existing** mechanism (verified); LR-3 adds no bespoke subsystem for any of them:

| Moment | Behavior | Owning mechanism (source) |
|---|---|---|
| Before the invitation | Clara cools loaves on the porch; player can check the oven, knead, take the solo loaf share | `residents.ts:59-65`; Build 7 actions |
| Offering | Offer surfaces inside ordinary Clara dialogue only when `canOfferInvitation` passes (read-only eligibility, doc 14 §8) | `dialogueEngine.ts:473-479`; offer choice flag `actions.ts:887-895` |
| Player accepts | `acceptInvitation` (offered→accepted, live check); toast names the venue — currently hardcodes "Linden Book Nook" (D6 fix) | `invitations.ts:255-278`; `actions.ts:897-907` |
| Player declines | `declineInvitation` archives `declined`, clears slot, **rewards nothing** | `invitations.ts:284-312`; LR1-04 |
| Player arrives | Enter reducer reconciles expiry, then places Clara as occupant if live+available; else visible `host_unavailable` expiry | shared enter path (doc 05 §5); as-built pattern `actions.ts:2973-3016` |
| During the activity | Clara is tick-skipped (no wandering, no encounters); she sits at the station facing the table; look-yaw tracks the player | `simulation.ts:653-656`; rig sync `NeighborhoodCanvas.tsx:2062-2109` [Reconciled `a80a220`: `:2086-2137`] |
| Completion | One atomic transaction: rewards +6/+2, host memory, journal memory, world event, archive `completed`, occupancy cleared | `activities.ts:161-336` |
| After completion | Clara's runtime emotion set warm for 90 min; the solo rituals are untouched; the memory is hers alone (no gossip write) | `activities.ts:303-313, 272-283` |
| Player never arrives | Window-end tick expiry: "The invitation with Clara quietly passed for today." (host-name templated, generic) | `invitations.ts:384-413, 357-361` |
| Clara unavailable at enter | Enter reducer expires with the "had to step out" line; **no occupancy is set** (no phantom occupant) | as-built `actions.ts:3004-3015`; LRTL-05 pin |
| Activity interrupted (player leaves) | Exit clears occupancy + `activeActivity`; the accepted invite stays live; re-entry re-places her (idempotent) | `actions.ts:3036-3055` pattern; LRTL-06 |
| Day ends | Sleep/day-advance archives with `day_end`, clears occupancy/`activeActivity`, dawn ejects the player from the interior | `invitations.ts:419-422`; `storage.ts:523-524, 636` [Reconciled `a80a220`: dawn eject `:555-648` (bakery wake `:557`, porch fallback `:584-587`, exterior eject `:612-613`); LR reconcile `:670`] |

### 1.6 Characterization constraints the design must not violate

1. Do not invent new backstory (no new NPC, no new lore objects) — the pastry moment uses the existing bake roster, the existing café table, the existing tea vocabulary.
2. Clara does not hand out currency or items in the shared activity; the solo loaf share already owns item grants (`shareMorningLoafAction`). Doc 14 §6.1's no-mutation list is binding.
3. Her pride and her morning craft are the point: she invites you to *share what the oven just made*, not to receive a service.

## 2. Hearth & Crumb — venue audit (source-verified)

### 2.1 Interior layout (`bakery.ts:24-120`; scene mirror `bakeryInterior.ts`, test-pinned both sides)

- **Bounds**: x ∈ [-3.0, 3.0], z ∈ [-2.4, 2.4] (`BAKERY_BOUNDS`).
- **Obstacles**: `bakery_oven` NW (-2.92..-0.85, -2.36..-1.5), `bakery_counter` W (-2.96..-2.2, -0.85..1.3), `bakery_prep` NE (0.85..2.6, -2.36..-1.55), `bakery_table` SE (0.75..1.95, 0.85..2.05).
- **Interactables** (all with hit proxies auto-generated from the table, `bakeryInterior.ts:954-967`): door S (0.0, 1.95), oven, counter ("Share the Morning Loaf"), prep ("Help Knead Dough"), notes shelf.
- **Door**: exterior approach `BAKERY_DOOR_POS` (-12.4, -7.05); interior spawn `BAKERY_DOOR_SPAWN` (0.0, 1.5) facing north into the kitchen; porch exit restore `BAKERY_PORCH_EXIT_POS` (-12.4, -6.8) with walkability fallback (`actions.ts:2672-2674, 2694-2695`).
- **Navigation**: `isBakeryInteriorWalkable` (radius 0.42) + axis-slide resolution (`bakery.ts:190-227`) + hub-routed waypoints over six hubs (`bakery.ts:229-294`); scene layer validates walk destinations and falls back to `findNearestInteriorWalkablePoint` (`NeighborhoodCanvas.tsx:1554-1568` [Reconciled `a80a220`: `:1577-1598`]).
- **Café corner (the candidate activity site)**: round table with two bentwood chairs at grid center (1.35, 1.45); **one registered seat** `bakery_seat_cafe_west` at seatPos (0.73, 1.45), approach (-0.2, 1.4), facing `atan2(0.62, 0) ≈ 1.5708` rad (east across the table), height 0.46 (`bakery.ts:297-308`); the east chair exists visually only (`bakeryInterior.ts:639-643` [Reconciled `a80a220`: `:643-647`] — "decorative counterweight"), with **no seat data**; a teacup, saucer, vase and rosemary sprig already dress the table (`bakeryInterior.ts:604-613` [Reconciled `a80a220`: `:604-616` incl. the rosemary sprig `:614-616`]) — the "two cups" staging is physically present in the scene today.

### 2.2 Usability verification of the activity location

The café corner passes every usability question in initiative §2.2 without any venue redesign:

| Question | Verified answer |
|---|---|
| Can the player approach? | Approach spot (-0.2, 1.4) is walkable (west aisle/hub path; seat targeting weights it at +0.35, `bakery.ts:348-367`) |
| Can the player interact? | Clicking the occupant hit proxy targets the resident with `immediateRange 2.6` (`NeighborhoodCanvas.tsx:1454-1472`); the seat spot target also exists within 2.0 m |
| Can the player participate? | LR-2's pattern — participation is the completion choice in dialogue or the station card; the player is never seated by the activity (verified: `completeSharedActivity` does not touch `playerPosture`) |
| Can the player leave? | `exitBakeryAction` restores the exterior porch position (`actions.ts:2690-2707`); dawn ejection exists (`storage.ts:523`) |
| Can the occupant be seen? | Occupant rig path exists for the nook and is venue-parameterizable (D8); the café chair mesh, contact shadows, and seated ground height logic (`computeSitGroundY(0.5, heightScale)`) are in place |
| Can anyone get stuck? | Seat-sit suppression (nook precedent `actions.ts:979-988`) prevents the player from sitting in the claimed chair; stand-up relocation uses each seat's own interior grid (`actions.ts:959-974`, the historic clip fix) |

Doc 13:91's recorded clash — "bakery_table sit-clash between doc 04's `bakery_table` and the as-built café chair" — is resolved by decision D3 (§5.1): the session claims the *chair*, the solo sit is refused with a visible line, and the table gains a lightweight interaction anchor.

### 2.3 What deliberately does not change

The oven/counter/prep/notes rituals, the bake roster (`BAKERY_BAKES`, deterministic per day, `bakery.ts:135-167`), the walkability tables, the obstacle boxes, and the scene builder's dressing are untouched except for the station-exclusivity guards (S3) and one new interactable anchor + occupant rig path (D3/D8).

## 3. The morning pastry — intended experience

### 3.1 The design question

*What makes `share_morning_pastry` a meaningful shared experience rather than another mechanically identical invitation?* The mechanical chassis (offer → accept → enter → complete) is deliberately shared with LR-2 — it is the proven, pinned architecture. The **meaning** must come from Clara, the venue, and the morning:

1. **It is a hosted breakfast, not a service.** Nora shares a book (the venue's product); Clara shares the *first bake of the day* (her craft's daily payoff). The day's actual bake — from the deterministic roster the player can already check at the oven — should be on the table. `getBakeForDay(world.day)` gives the moment its specific, daily-varying object ("today it's the Sunflower Sourdough").
2. **It answers her wistfulness.** Her personality line ("secretly misses the old morning bell") and the reconciliation arc establish that Clara's joy is about *mornings being shared again*. A pastry split at the busy café table she loves is the small, repeatable version of that joy.
3. **It is short.** Doc 06's superseded sketch (8-minute beat) and the initiative's own warning ("a cozy game should not turn every ordinary interaction into a lengthy minigame") agree: one arrival beat, one conversation beat with a single contextual choice, one completion beat.

### 3.2 Recommended activity structure (one short, characterful ritual)

| Beat | What happens | Mechanism (all existing) |
|---|---|---|
| Invitation (morning only — D2) | Clara, on the porch (or finishing an errand back toward the bakery), offers to split the morning bake at the café corner. Choice: accept / decline. | Clara offer topic in `dialogue/invitations/clara.ts` (quartet, §5.3) |
| Arrival | Enter the bakery: Clara is settled at the café corner with today's bake and the two cups; enter toast names her and the venue | Shared enter path (doc 05 §5) + def `arrivalLine` |
| Conversation | One branching node: she plates the pastry and pours the tea; the player picks one of two warm replies — one asks about the old morning bell (flavor only), one simply shares the moment. **No state forks, no rewards on either branch** — the choice is characterization, not mechanics. | Dialogue nodes in `clara.ts`; `requestedTrustDelta: 0` per doc 14 §5.2 |
| Completion | The same dialogue (or the café-table card) offers "Share the morning pastry" → `completeSharedActivity('share_morning_pastry')`: memory card "…", +6/+2 outside the smalltalk cap, host memory, world event, archive, cleanup | `activities.ts:161-336` with venue-aware text (§6.2, F1) |
| Afterward | Warm exit line; the day's solo rituals remain available (knead bonus untouched — doc 15 §3.2 item 2); her everyday dialogue can naturally reference the memory via the existing memory-retrieval scoring | `dialogueEngine.ts:816-1047` freshness scoring — no new topic needed |

### 3.3 Alternatives evaluated and rejected (structure level)

| Alternative | Why rejected |
|---|---|
| **Two-station beat**: knead together at the prep table, *then* share at the café table | Requires sequencing state between two stations (new persisted state or derivation), doubles anchors/rigs/guards, and collides with the existing solo knead ritual's meaning (knead-first already "helps Clara" — doing it again inside the invite would double-count the same fiction). Violates the restraint mandate and D7's registry-only preference. Doc 14 §6.2: "Existing knead/share remain unchanged." |
| **Minigame beat** (tap-rhythm kneading / pour tea timing) | No precedent in the codebase's action model (all interactions are state transactions, `PropInteractionResult`/dialogue choices); adds a new interaction genre for one activity — overdesign. |
| **Contextual memory-choice with lasting consequence** (e.g., player chooses which pastry to split → different `memoryId`) | Would need two static memory ids for one activity (journal cap headroom, doc 02 §7 row 5) and an extra def field; the warm-memory pipeline is idempotent on one id (LR2-07). Not worth the state. |
| **Clara visits the player's cottage instead** (reciprocity inversion) | Inverts the entire occupancy architecture (host = interior owner; occupant slot = resident in *their* interior; sanitizer invariant `occ.location === playerLocation` with accepted host invite, `migrations.ts:1540-1577`). A whole second lifecycle for zero new architecture value. Postponed as a possible future milestone idea, not LR-3. |

### 3.4 Player journey legibility (initiative §2.4)

- *Why is Clara inviting me?* — Her offer dialogue says it in her voice, grounded in her schedule slot activity ("the loaves are just out of the oven") — no tutorial text.
- *What does accepting mean?* — The accept toast (venue-truthful after D6) + the journal "Today's Invitation" card (already registry-generic, shows "Shared Morning Pastry — Hearth & Crumb Bakery" + window clock, `journal.ts:1169-1186`).
- *Where do I go, how do I participate?* — Same as LR-2: door → she is seated → click her (or the table) → choice. Zero new UI surfaces.
- *Is it available right now?* — The offer topic only surfaces when `canOfferInvitation` passes; the journal card shows the window; the +2h button and sleep make expiry legible with visible lines.
- *What if I'm late?* — Strict-predicate expiry with the generic host-name toast; no penalty, no reward (LR1-05/12 semantics).
- *What changed afterward?* — Memory card in the journal, +hearts/reliability visible via existing milestones, warm exit line; her memories may surface it in later chats (existing retrieval).

## 4. Systems research — what the experience rides on

### 4.1 Invitation foundation (LR-1, unchanged)

`invitations.ts` verified end-to-end (439 lines): single active slot, 2-day spacing, tier floor vs def thresholds, guard check, 6 m schedule-radius availability + exterior-encounter check (`:59-79`), strict live/expired duality (D-03, `:85-125`), D-17 contiguous-home window cap (`:127-152`), offer/accept/decline/expire (`:209-378`), zero-GC tick reconciler (`:384-413`), day-advance reconcile (`:419-422`). All host-generic. **No changes** to any of these for LR-3 (doc 05 keeps this invariant except the one additive helper, §5).

### 4.2 Shared activity transaction (LR-2, one text-level gap — F1)

`activities.ts:52-72` registry + `:161-336` transaction. The transaction's *mechanics* are fully generic (verified line-by-line), but four **content** lines are nook-specific and would produce factually wrong journal/world-event/toast text for Clara:

- `:214` — the host-unavailable completion refusal toast hardcodes "…the shared **reading** can't finish right now." **[Reconciled `a80a220`: surfaced by the reconciliation audit — a fourth venue-coupled string; covered by D9's def-level composition and pinned by doc 06 LR3-88]**
- `:223` — `getFeaturedBookForDay(world.day)` (the nook's featured book) is loaded unconditionally;
- `:231` — journal memory summary hardcodes "Read through ${book.title} … inside Linden Book Nook";
- `:281` — world event summary hardcodes "Shared ${book.title} … at Linden Book Nook."

A bakery completion would journal "Read through <book> together with Clara inside Linden Book Nook". This is **Finding F1** — doc 02 §5's claim "`completeSharedActivity` needs no change" holds for mechanics but not for content text; doc 05 §6.2 specifies the minimal def-level fix (per-def summary composition), and doc 06 adds journal-text regression cases.

### 4.3 Occupancy & the tick (`occupancy.ts`, `simulation.ts`)

Single global occupant slot (`types.ts:787`); `setOccupant`/`clearOccupant(location)`/`isStationOccupied` verified (`occupancy.ts:29-86`). Tick: the occupant resident is fully skipped (`simulation.ts:653-656` — no movement, no activity re-selection, no encounters); expiry runs every advancing tick (`:623`); the pure wrapper clones the LR slices (`:1092-1103` [Reconciled `a80a220`: `:1106-1117`; a residents per-record clone was inserted at `:1059-1072` by the reliability work — tick purity unchanged]). Tick **never** creates occupants (LRTL-04 pin) — ownership stays with the enter reducer.

### 4.4 Station-exclusivity surface (S3 target verified)

- Nook precedent: solo shelf browsing refuses while the reading session owns the room's featured-book resource (`actions.ts:3111-3123`); player sit on the claimed armchair refuses (`actions.ts:979-988`).
- Bakery surface (the doc 13:91 same-minute co-fire hazard): `checkMorningBakeAction` writes `bakeCheckedDay`, `helpKneadDoughAction` writes `kneadedDay`/`kneadingSessions`, `shareMorningLoafAction` writes `loafSharedDay`/`loavesShared` and the inventory (`actions.ts:2740-2885`). While the pastry session occupies the café corner, these three reducers must refuse visibly and mutate nothing; the knead→double-share bonus logic between them is untouched otherwise (doc 15 §3.2 item 1–2).

### 4.5 Persistence & day transition (S7 verified — registry-only is sufficient)

- Sanitizer LR block (`migrations.ts:1380-1600` [Reconciled `a80a220`: `:1532-1844`]): active invitation requires `SHARED_ACTIVITIES[activityId].hostId === hostId` (`:1434` [Reconciled: `:1606`]) — Clara invitations validate the moment the def is registered; `validHosts` is `RESIDENT_ORDER` (clara included, `:1390` [Reconciled: `:1544`]); non-live actives archived on load (`:1503-1521` [Reconciled: `:1696-1714`]); `activeActivity` must match a live invite (`:1523-1538` [Reconciled: `:1716-1755`]); occupancy must match `playerLocation` + accepted live invite + invitationId (`:1540-1577` [Reconciled: `:1757-1808`]).
- `stationId` is checked only as a non-empty string (`:1555-1556`) — **SR-7's registry-resolution rule exists only on the unmerged reliability branch** (branch `migrations.ts`; verified: main's `git diff 545e323..b71bb3c -- src/game/actions.ts` is empty, branch surface is migrations/storage/journal/storylines/simulation(+tests)). Gate-conditional contract in doc 05 §10. **[Reconciled 2026-11-22: superseded — the reliability integration shipped SR-7 on main (`migrations.ts:1772-1773`): a stationId that does not equal `SHARED_ACTIVITIES[active.activityId].stationId` now clears occupancy with a classified warning, pinned by `save-integrity.test.ts` (SR-7 fixture). Doc 05 §12 and doc 06 LR3-34/LR3-81 carry the unconditional rule.]**
- Day transition: `advanceToNextDay` ends with `reconcileLivingRelationshipsOnDayAdvance` (`storage.ts:636` [Reconciled `a80a220`: `:670`]), dawn ejects interior sleepers to their porch exit (`:523-589` [Reconciled: `:555-648`]).
- **No new persisted state is required** (D7): the invitation record, `lastOfferDayByHost['clara']`, occupancy slot, and `activeActivity` all exist; the activity def is code. A v12 bump would be forced only by genuinely new state — none was found in this research.

### 4.6 Scene layer (D8 verified)

The nook occupant rig is Nora-hardcoded in three places: rig construction (`NeighborhoodCanvas.tsx:922-939` [Reconciled `a80a220`: `:945-961`] — `RESIDENTS.nora.appearance`, hit proxy `targetId: 'nora'`), click routing (`:1454-1472` [Reconciled: `:1477-1502`] — `walkDest = NOOK_OCCUPANT_APPROACH_POS`, action label switch on `'share_featured_reading'`), and per-frame sync (`:2062-2109` [Reconciled: `:2086-2137`] — nook-interior-gated; the BUILD 04 merge added an `emotionIntensity` reset at `:2115-2118` that the D8 parameterization must carry). LR-3 needs one venue-parameterized occupant path (rig per interior, def-driven approach/labels) rather than a second hardcode; spec in doc 05 §8.

## 5. Decisions this research feeds

### 5.1 D3 — occupant anchor: the as-built café chair

Recommendation: `stationId = 'bakery_seat_cafe_west'` (the only registered seat), Clara seated facing east across the table; a new lightweight interactable `bakery_cafe_table` becomes the *card anchor* (the station branch that offers the completion action when the station is claimed, mirroring `interactWithNookProp`'s `nook_chair` branch, `actions.ts:3071-3093`). Rationale: the sit-suppression guard can match the seat id directly (nook precedent); the seat spot's approach/facing data already exists and is test-pinned; a new fictional table station would add seat data + walkability evidence for zero gain. The east chair stays decorative (the player's participation is the conversation, not a second seat).

### 5.2 D2 — morning-only offer phase (new evidence)

The activity's identity is morning (id, Clara's morningLark 0.9, the bake roster, the morning porch slot). Verified reality: without a phase constraint, golden (5.533 m) and dusk (0.0 m) offers pass the generic gate — a "morning pastry" offered at 8:30 PM with a window into 1260. Recommendation: a new **optional, data-driven** def field `offerPhases?: readonly TimePhase[]` checked in `canOfferInvitation` (one field, one check, zero effect on Nora's def). This narrows availability vs doc 15:90's minimum (afternoon-only suppression) — it is a gameplay-facing restriction and is flagged for user approval in doc 07 (D2). The complementary morning window cap is already computed correctly: with `defaultDurationMinutes: 180`, `computeOfferWindow` caps the end at **719** when the away-afternoon rule applies (`invitations.ts:141-142`), never past Clara's contiguous home availability (see §6.3 for the 690–719 nuance).

### 5.3 D4 — discoverability: generic gates only

Recommendation: tier/affinity floor + spacing + availability, exactly like Nora — no new story gate in LR-3. Clara's arcs (herb loaf, orchard, rift) already give the friendship texture; a designed gate (Nora's postcard pattern, recovery doc 05 §5) would be *new storyline content*, which is out of LR-3's scope boundary. Flagged in doc 07 as an owner-visible but non-blocking choice.

## 6. Comparable design patterns (research, not code to copy)

| Pattern | Where seen | What LR-3 borrows | What it refuses |
|---|---|---|---|
| Schedule-gated heart events | Stardew Valley | Availability windows tied to the NPC's day; event fires at a specific venue; miss it and it re-offers later | Arbitrary hard locks; missable-forever content (the 2-day spacing + daily windows keep it forgiving) |
| Villager home visits & hosted tea | Animal Crossing | Short hosted visit inside the NPC's home; the host's furniture and routine decorate the beat; visit ends politely | Real-time appointment pressure |
| Meal-sharing scenes | Classic RPG inn/breakfast beats | The meal as a vehicle for one warm character beat; one choice, no branches that matter | Minigame overlays |
| Shared task → shared memory | Cozy Grove / Spiritfarer | Completing a small shared action yields a journal memory and a relationship tick | Persistent task chains, currencies |
| Interior exclusivity | The game's own LR-2 as-built | Station claim + refusal lines + single occupant slot | Generic resource-lock frameworks (initiative §4.3; the two-venue scale doesn't justify one) |

No new dependencies; every borrowed pattern maps onto an existing system (dialogue registry, transaction, occupancy slot, journal).

## 7. Risks identified by this research

| # | Risk | Evidence | Disposition (docs 05–07) |
|---|---|---|---|
| R-a | Wrong-venue journal/world-event text (F1) | `activities.ts:223, 231, 281` | Def-level summary composition (doc 05 §6.2); journal-text tests (doc 06 §4) |
| R-b | Non-morning offers pass the gate | §1.2 distances | `offerPhases` def field (D2; owner approval) |
| R-c | Availability gate vs actual position divergence (morning errands) | §1.3 | Voiced in dialogue; availability stays schedule-based (restraint; doc 05 §7) |
| R-d | 690–719 "dead zone": invite live but host slot away | `computeOfferWindow` caps at 719; afternoon phase starts 690 (`time.ts:16-22`) | Accepted as-built semantics (identical for Nora today); enter path fails *visibly* (`host_unavailable`); explicit acceptance case (doc 06 §2) |
| R-e | Sit-clash on the claimed café chair | doc 13:91; `bakery.ts:297-308` | Sit refusal line + station guard (D3) |
| R-f | Same-minute knead/share co-fire | doc 13:91; `actions.ts:2740-2885` | S3 guards + no-mutation battery (doc 06 §3) |
| R-g | Golden-hour reconciled-schedule divergence (gate reads raw schedule) | §1.2 fact 2 | Moot under D2 (morning-only); documented so the next venue knows |
| R-h | Golden-snapshot regeneration drift | `dialogueRegistry.test.ts:50-65` | Regenerate from live registry with written behavioral justification (HANDOVER §17 convention) |
| R-i | Stale/wrong `stationId` survives load on unhardened main | `migrations.ts:1555-1556`; SR-7 branch-only | Gate-conditional: re-derive SR-7-equivalent inside LR-3 if the owner picks path (b) of doc 03 §5 **[Reconciled 2026-11-22: CLOSED — SR-7 shipped on main via PR #11 (`migrations.ts:1772-1773`, pinned by `save-integrity.test.ts`); the risk no longer exists]** |
| R-j | `teaching.known` accidentally written (doc-10 trap) | `activities.ts:48-49`; doc 03 §1 | No `knowledgeGranted` on the def + explicit assertion battery (doc 06 §4) |

## 8. Open questions requiring user approval (carry into doc 07)

1. **D2/offer phase**: morning-only offers for `share_morning_pastry` (recommended) vs doc 15's afternoon-only minimum (golden/dusk offers technically pass today's gate). — *gameplay-facing; approval requested.* **[Reconciled: APPROVED as D10 — `offerPhases: ['morning']`, owner directive 2026-11-21, recorded in `docs/architecture/systemic-reliability-integration/08-lr3-d10-owner-decision-record.md`; NOT implemented; doc 07 D10 carries the register update.]**
2. **D4/discoverability**: generic tier/affinity gates only (recommended) vs a designed story gate. — *non-blocking; owner may opt into content later.* **[Reconciled: unchanged — still owner-visible, non-blocking; recommendation (a) stands.]**
3. **Reliability gate path (a)/(b)/(c)** (doc 03 §5): unchanged by this research; F-ENTER-1 and SR-7 dispositions are phrased gate-conditionally in doc 05 so the design is executable under either path. — *owner decision, blocking for implementation start (not for design approval).* **[Reconciled: RESOLVED — path (a) executed (PR #11 merged as `f1c2af4`, verified post-merge by PR #12; 528/528 re-run first-hand). The gate-conditional phrasings in docs 05/06 have been updated to the unconditional main behavior.]**

## 9. Recommended design (one-paragraph summary)

Clara invites the player — morning-only — to split the day's bake at her café corner; the existing LR-1/LR-2 machinery carries the entire lifecycle unchanged; the shared enter path (F-ENTER-1 resolution) places her at the as-built café chair; one short dialogue with one flavor choice completes through the existing transaction with venue-true text; station exclusivity guards keep the oven, prep table and counter honest; nothing new persists; the journal, gossip, memory, and schedule systems do the rest of the storytelling for free.

## 10. Amendments to the Phase One record (primary-source evidence)

1. **Doc 01 §5**: afternoon-slot distance corrected 6.9 m → **8.938 m** (conclusion unchanged); golden/dusk eligibility and the raw-schedule availability reading recorded (§1.2).
2. **Doc 02 §2/§5**: "`completeSharedActivity` needs no change" is amended to "`completeSharedActivity` needs **no mechanical change**; its venue-text composition (book + venue name at `activities.ts:223/231/281`) is nook-specific and must move to def-level composition for LR-3" (F1, §4.2).
3. Doc 02's seam list gains two entries: the def-level summary composition (folded into seam 1's def addition) and the scene click-routing parameterization already implied by seam 8 (made explicit at `NeighborhoodCanvas.tsx:1454-1472` [Reconciled `a80a220`: `:1477-1502`]).
4. **[Reconciled `a80a220`] §1.4 storyline citations corrected** (see §1.4): `conflict_plaza_lanterns` involves no Clara; her registry storyline footprint is `side_herb_loaf` (lead), `side_orchard_gathering` (lead), `side_pip_zine` (participant); her bell-arc hook is `quest_clara_rift` (`bellQuest.ts:278-282`). §1.3 gains the two omitted weighted extras (`clara_rain_oven`, `clara_cafe_tables`). §4.2's F1 inventory gains the fourth venue-coupled string (completion-refusal toast, `activities.ts:214`).
5. **[Reconciled `a80a220`] Citation re-base** for the files the reliability/BUILD merges changed: `migrations.ts` sanitizer block `:1532-1844` (stationId rule `:1772-1773` shipped); `storage.ts` dawn eject `:555-648`, LR reconcile `:670`; `simulation.ts` pure clone `:1106-1117`, resident clone `:1059-1072`; `journal.ts` invitation card `:1183-1200`; `App.tsx` handler `:961-975`; `NeighborhoodCanvas.tsx` rig `:945-961`, routing `:1477-1502`, sync `:2086-2137` (BUILD-04 `emotionIntensity` reset `:2115-2118`). All other cited files are byte-identical between the baselines.
6. **[Reconciled `a80a220`] Golden-snapshot stability re-confirmed**: the topic registry is unchanged by the BUILD 03/04 and reliability merges (`dialogue-topics-golden.json` still 85 topics; Clara still 10); the 85 → 89 regeneration remains exclusively an LR-3 obligation.
