# 02 — Regression Root-Cause Analysis

All three root causes were re-derived from git evidence on this branch (not taken from the previous report), and every quoted block was byte-compared.

## D-01 (P1) — exploration discovery dead in production

**Symptom:** walking into a Wild Hollows zone grants no discovery in gameplay; `discoverExplorationInPlace` runs only when tests call it directly.

**Root cause (verified):** commit `4ad2e5f` ("feat(nook): add Nora's book reading invitation ritual") rewrote the top of `stepSimulationInPlace` and replaced the exploration import with the LR invitation reconciler:

```
git diff 9cde87d 4ad2e5f -- src/game/simulation.ts
- import { discoverExplorationInPlace } from './exploration';
+ import { expireInvitationsInPlace } from './invitations';
…
-  // 0. Wild Hollows exploration discoveries (Build 10): deterministic, exterior-only,
-  // pure in-place sideFlag + journal memory grant — same discipline as encounters.
-  {
-    const outside = world.playerLocation === 'exterior';
-    const ex = outside ? world.playerPos.x : world.exteriorPlayerPos.x;
-    const ez = outside ? world.playerPos.z : world.exteriorPlayerPos.z;
-    discoverExplorationInPlace(world, ex, ez);
-  }
```

The unit tests in `exploration.test.ts` stayed green because they call `discoverExplorationInPlace` directly — the exact "function exists but the lifecycle is unwired" trap the audit (doc 12 gap analysis) predicted.

**Why the suite stayed green:** no test drove discovery through `stepSimulationInPlace`; the golden/registry tests did not cover exploration at all.

## D-02 (P2→P1) — Wild Hollows dialogue topics silently dead

**Symptom:** `daily_mina_foxglove` / `daily_rowan_beeline_checkin` never surface; the wilds module survives as an orphan export.

**Root cause (verified):** the same commit swapped the dialogue registration:

```
git diff 9cde87d 4ad2e5f -- src/game/dialogue/index.ts
-import { WILDS_TOPICS } from './interiors/wilds';
+import { INVITATION_TOPICS } from './invitations';
…
-  ...WILDS_TOPICS, // 2 topics (Build 10 — The Wild Hollows exploration check-ins)
+  ...INVITATION_TOPICS, // Living Relationships LR-1 / LR-2
```

plus a regenerated `scripts/dialogue-topics-golden.json` (85 → 83 rows). The registry test (`dialogueRegistry.test.ts`) compares the live registry against the golden **self-referentially** — a snapshot confirms output has not changed relative to itself, so regenerating it converted a behavioral regression into a green suite ("snapshot fraud" blind spot).

**Compounding record loss:** the same commit overwrote the Build-10 WORKLOG Entry 048 with the LR Entry 048 (audit doc 16 D-02 evidence).

## D-03 (P2) — invitation expiry predicate duality, with a save-time hazard

**Symptom:** the tick reconciler (`expireInvitationsInPlace` → `isInvitationExpired`) tolerated pre-window actives; the save/load sanitizer (`sanitizeLivingRelationships`, `migrations.ts:1505`) enforced the strict `isInvitationLive` — and `serializeWorldState` runs the sanitizer **on every save**.

**Measured hazard (deeper than the audit's description):** a hand-staged pre-window active (window [600, 780], clock 497) survives unbounded ticks, but `serializeWorldState(world)` already returns `"invitations.active": null` — the archive happens **at save**, with the sanitizer's `'non-live active invitation archived on load'` warning **discarded** (`serializeWorldState` returns only the string). So the "tolerant" model produced a state that the very next autosave silently destroyed: internally inconsistent and a save-compatibility trap.

**Production reachability:** none — `computeOfferWindow` anchors `windowStartMinute` to the offer minute (doc 20 §4) and the clock only advances, so only hand-staged/malformed states can be pre-window. The tolerant half existed solely to keep the literal (unreachable) LR2-04b staging alive; doc 21 §2.4 (Decision B) already mandates re-anchored staging.

## D-04 (P2) / H-1 — during-activity host drift unowned

`completeSharedActivity` (activities.ts) validated day/window/location/occupancy but never the host. Independently reproduced (adversarial specialist, doc 08 §3): live accepted invite → `enterNookAction` (occupancy set) → inject encounter with `participants: ['nora']` → **real** `serializeWorldState` → `deserializeWorldState` round trip (occupancy + encounter both restored, zero warnings) → `completeSharedActivity` → **ok:true** with +6/+2 affinity, the completion memory, and the host NPC memory — while `isHostAvailableForActivity` was false. Not reachable through ordinary play (the occupant skip in the tick prevents encounter candidacy; the enter reducer refuses busy hosts), but it is the last unowned drift window and the sanitizer gap made it load-reachable. Disposition: repaired (doc 05 §4).

## Why the golden/registry tests could not catch D-02 — systemic note

`dialogueRegistry.test.ts` pins: unique ids, count + id sequence vs golden, metadata vs golden, build-function presence. Every assertion compares the registry **to its own snapshot**. The fix keeps the golden (it is the modularization ordering contract) but adds `build10-recovery.test.ts` BD10-10/11, which pin the wilds rows against **hardcoded Build-10 expectations** so future snapshot regeneration cannot hide a registry loss.
