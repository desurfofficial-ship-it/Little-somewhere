# Social Foundation — Post-Integration Adversarial Audit
# 05 — Emergent Stories and Narrative Knowledge Audit (SF-3)

**Subject:** `src/game/emergentStories.ts` (375 lines, new in `8b715fc`); consumers: `journal.ts` `buildPeopleList` → `deriveResidentChapter` → `JournalDrawer.tsx`.
**Central requirement (brief §7):** the game may infer social meaning, but must not pretend the player knows things never witnessed, discovered, or learned.

## 1. The seven seeds (§7.1) — audited independently

| Seed (priority) | Eligibility | Player-knowledge requirement | Degrades when | Notes |
|---|---|---|---|---|
| open_visit (80) | accepted + `isInvitationLive` + player outdoors | the player accepted it (by construction) | window end; indoors; unknown host (SF3-02b) | gated by a game mechanic the player opted into — not story pressure |
| rift_bridging (70) | suppressed pair + **both** sides ≥ friendly + `playerKnowsTie` | bell flag (pair-blind — R-03) **or** player-known memory naming both (TTL-checked) | suppression lift; memory TTL/eviction | no legitimate play path creates a second suppressed pair in shipped content (verified — see §2) |
| shared_tradition (60) | ≥ 2 completed visits with host | the player made those visits | history-cap eviction (count can regress — P3) | no met/tier gate (P3 hardening note) |
| quiet_feeling (50) | met + ≥ acquaintance + (feeling ∈ {sad, frustrated} ∨ mood wistful) | the same feeling is already published on the People card (`emotionLabel`) | mood/emotion change | label-contradiction defect R-04; no recency requirement (P3) |
| thank_you_owed (40) | keepsake received + `giftsGiven === 0` + ≥ acquaintance | the player literally received the item | `giftsGiven > 0` (self-heal verified) | reads keepsake state, not invitation history |
| first_steps (30) | met + `talkedCount < 3` | the player's own count | talkedCount ≥ 3 | standing observation by design; zero-FOMO phrasing pinned by SF3-01 |
| community_pulse (20) | booksRead + harvests + projectsAdmired + loavesShared + memories ≥ 8 | all player-visible (own counters + own journal) | effectively permanent once crossed | counters never reset; memories ledger plateaus at 96 (newest-first trim) — pulse is **monotonic**, it cannot collapse (candidate claim refuted) |

No seed reads `worldEvents` (including private `npc_social` records); no RNG; no wall clock; no cooldowns; cap 6 with stable sort (priority desc, id asc).

## 2. Player-knowledge integrity (§7.2)

Probe results (scratch-verified): unwitnessed events — no leak path; NPC-only knowledge — a private memory naming a pair does **not** open bridging; gossip — a gossip memory *told to the player* does open bridging (legitimate: the player heard it); witnessed-but-undiscovered — covered by the memory gate; deleted/evicted — silently closes seeds (graceful-degradation doctrine verified); stale (TTL-expired) memories — skipped; prerequisites that became false — self-heal (suppression lift, gift acknowledged, talked ≥ 3 all verified live); unknown participants — filtered without crash; hand-edited suppressed pairs **persist through save/load** (sanitizer admits any registered-resident pair with tension ≥ 45) — which is what makes R-03 durable once triggered.

**R-03 (P2, latent) — the pair-blind bell gate.** `playerKnowsTie` (emergentStories.ts:92) returns true for *any* pair when `world.flags.heardBellMystery` is set. The bell discovery is canonically the Clara–Arthur journal gate (journal.ts:696-703); as written it transfers to every future suppressed pair. Scratch repro: fresh world, `heardBellMystery = true`, hand-staged suppressed `pip:sora` (zero pair evidence) → `seed_rift_bridging_pip_sora` fires "You know both sides of the quiet rift" and both People cards show the bridging chapter. **Why latent, not live:** the only suppression-capable writer in shipped content is authored dialogue; the worst reachable accumulation (`barnaby:toby` affinity 24→10, tension 28) never crosses suppression (affinity < 0 ∨ tension ≥ 45), and the sole baseline suppressed pair is `arthur:clara`, for which the bell flag *is* exactly the player-visible evidence. The leak therefore requires future content (LR-4/LR-5 are the stated extension points) or hand-edited saves. Doc 22 line 55 codifies the pair-blind gate without noting the cross-pair implication — an internal inconsistency with the module's own header ("pair-level facts are surfaced only when the player has player-visible evidence of the tie"). **Fix before any future content writes negative npc-relations:** scope the flag to `arthur:clara` (or make evidence pair-scoped). No SF3 test pins cross-pair behavior.

## 3. Determinism (§7.3)

PASS: twice-derived seeds JSON-identical; serialize→deserialize round trip preserves every seed input (flag, npcRelations, keepsakes, four counters, memory TTL fields, invitation history, mood/lastEmotion) with zero warnings and byte-identical seed + chapter output; reversed `npcRelations` insertion order yields identical output (sorted scans; `RESIDENT_ORDER` iteration; strict-`>` tie handling). No `Math.random`/wall-clock in the module. The only order-sensitive input is the `invitations.history` **array order** itself (array semantics — see P3 "latest visit" note in doc 13).

## 4. False positives (§7.4)

Friendship story without meaningful interaction — bridging needs only affinity ≥ 50 (3 days of capped small talk); the copy claims only "warm terms": acceptable. Tradition without repeated activity — 2 completed visits required; writers idempotent; load dedupes (in-session duplicates would double-count — latent P3 hardening note). Gratitude without valid event — impossible (`neighborGiftsReceived` written only inside the gift-reward flow). Quiet-feeling without evidence — fires off NPC-internal state the UI already publishes; the real defect is the wrong-label contradiction (R-04). Community from stale info — counters never reset; monotonic. First-steps repeating — standing derivation by design. Bridging after reconciliation — suppression lift removes seed + chapter (verified).

## 5. Narrative FOMO (§7.5)

Clean. Seeds are standing derivations — never persisted, no timers, no quests, no penalties, no login pressure. The only time-gated seed (`open_visit`) is gated by the invitation *game mechanic* the player opted into. Copy avoids obligation language (regex-pinned for open_visit; siblings use "could/might/perhaps"). One copy nit: "a kind word is still owed" (chapter keepsake line) is the most obligation-flavored phrase in the surface — P3 tone note for the copy owner.

## 6. Journal freshness (§7.6)

Chapter derives live per `buildPeopleList` and is **never persisted** (repo-wide grep; serializer allow-list drops it structurally). Self-heals in every branch (verified live). Hidden-fact re-audit per branch: all inputs player-known — the only leak vector is R-03's pair-blind flag. No branch quotes `npc_social` records or private memory text.

## 7. Consumers and cost

`buildPeopleList` ← `buildPocketJournalView` ← `JournalDrawer` `useMemo([world, seenKeys])` — drawer always mounted; recompute per **world commit** (~40 commit sites: talk/gift/visit/advance/enter-exit), never per frame. Measured: full 10-resident chapter sweep ≈ 24.8 µs (rich world, 20k iters); whole `buildPocketJournalView` 0.16–0.57 ms. Negligible.

## 8. Findings

- **R-03 (P2, latent)** — pair-blind bell gate (§2).
- **R-04 (P2)** — quiet-feeling trigger/label contradiction: trigger is `feeling ∈ {sad, frustrated} ∨ mood === 'wistful'` but the label reads `getEmotionLabel(feeling ?? 'sad')` — when the *mood* fires the trigger and the resolved feeling is non-low, the copy names the wrong emotion ("Pip has seemed **eager** lately"; chapter: "has seemed **peaceful** lately… check-in might land well"). Reachable in live play: fresh Clara/Arthur spawn wistful (residents.ts:1219), conversations lock mood 180 min while the sim refreshes `rt.emotion` every ~35 min, gate is acquaintance-only. Fix: label from the low signal (`moodToEmotion('wistful')`) or require the resolved feeling itself to be low. Same latent pattern in the seed title (emergentStories.ts:216-229).
- **P3 batch:** tradition count can regress under cap-12 eviction (narrative counts "down" over time); shared_tradition/thank_you_owed lack the `met` gate their siblings have (hand-edited-save class only); chapter returns the *first sorted* suppressed pair for multi-pair residents (arthur:barnaby sorts before arthur:clara — shadowing risk only if multiple pairs ever exist); `evidenceCount` of community_pulse counts the player's own journal ("shared doings" is a mild stretch); duplicated history rows would double-count in-session (latent).

## 9. Verdict (SF-3)

Deterministic, derive-only, self-healing, honest about evicted evidence. One latent knowledge-boundary defect (R-03) and one live narrative-correctness bug (R-04); both carry precise fixes. Nothing blocks LR-3; **R-03 must be fixed before LR-4/LR-5 content that can author new rifts.**
