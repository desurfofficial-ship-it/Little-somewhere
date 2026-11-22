# Document 2 — Defect and Root-Cause Report

Severity: **P0** = breaks gameplay/core loop · **P1** = significant and frequent annoyance · **P2** = polish/latent/edge. All line numbers at base tip `9653b76` (layout identical to `34905d5` for cited files). Evidence from five independent investigations, reconciled; camera-block and seating claims re-verified by direct reads.

---

## A. Fountain does not match the reference (Problem A)

**Observable behavior.** In-game fountain reads as an octagonal stone trough with a busy corbel/pilaster rhythm and teal water; the reference (supplied image, fountain in a cobble plaza) is a fully circular two-tier fountain: thick rounded bullnose rim, warm cream stone, pale-blue water, multiple arcing streams from the upper tier, droplets, and a ring of small green/grey decorative stones at the base.

**Reproduction.** Load the plaza (or repair the fountain via quest); compare against reference.

**Root cause (authoring, not state).**
1. Silhouette: aprons are 8-segment cylinders + 8 corbels (`landmarks.ts:329-365`) → faceted octagonal read; basin lathe is 24-seg (`:338-354`).
2. Water color: `createStorybookFountainWaterMaterial` base `#6BB8C8` teal (`waterShaders.ts:190-274`) vs reference pale blue.
3. No decorative stone ring around the base — the only pebbles are *submerged* (`:409-439`); base has moss tufts only (`:442-462`).
4. Streams exist (12 tube arcs, `:578-621`) but their arcs/density do not match the reference's cascade pattern; droplets are only 20 spheres (`:623-634`).
5. Performance smell: no `mergeGeometries` in this builder → **~99 draw calls when flowing** — the largest single-landmark cost in the plaza.

**Affected components.** `landmarks.ts` builder, `waterShaders.ts` fountain material, `environmentRenderer.ts` animation hooks, `models.ts` FountainRig contract, `worldMap.ts` collision/metrics, `actions.ts` wish splash points.

**Severity.** P1 (visual identity; user-flagged).

**Related latent defect (found during audit).** Registry anchor mismatch: `PROP_INTERACTABLES` places `fountain_plaza` at `(0, 4.1)` (`worldMap.ts:279`) while the fountain center/basin/collider/proxy all sit at `(0, 1.5)` (`worldMap.ts:94`, `landmarks.ts:299`, `NeighborhoodCanvas.tsx:1174-1179`). Currently masked because every consumer special-cases the id; any rebuild that trusts the registry teleports interactions 2.6 m south. P2, must be fixed *first* in the fountain phase.

---

## B. Benches / furniture quality (Problem B)

**Observable behavior.** The single outdoor bench design reads flat and thin: open iron frame, slim slats, no softness; cushions appear only in winter and are rust-red, not the mint/sage upholstery language of the reference interior image. Interior armchairs (nook, copperwheel) are blocky primitives with blankets, far from the reference's rounded upholstered forms.

**Root cause.**
1. Outdoor benches: one design (`buildStorybookBench`, `landmarks.ts:910-1040`) instanced 7×; open iron-frame language, slat geometry thin (0.105 backrest slats, 0.06 legs).
2. Palette has **no mint-green fabric constant** — cushions use ad-hoc hex `#B3554A`/`#C86446` (`landmarks.ts:1002-1003`); `STORYBOOK_PALETTE` (`materials.ts:240-274`) lacks upholstery entries.
3. Interior armchairs are primitive-assembled (nook: box shell + blanket `bookNookInterior.ts:495-518`; copperwheel: shell + footstool `copperwheelInterior.ts:718-776`) — no cushion geometry, no rounded shell arms.

**Affected components.** `landmarks.ts` (bench), `bookNookInterior.ts`, `copperwheelInterior.ts`, `bakeryInterior.ts` (bentwood chair), `cottageInterior.ts` (stools), `materials.ts` (palette).

**Constraints that must hold.** `userData.seatTopY` (0.365), `userData.backrestFrontZ`, `seatMeshYaw` yaw binding, per-bench circle collider r 0.42, and stand-up approach anchors (`SEAT_SPOTS.approachPos`) must be preserved or re-derived — the seating contract is regression-locked (15 tests).

**Severity.** P1 (user-flagged).

---

## C. Armchair sit orientation (Problem C) — already fixed; residual defects listed

**Root cause of the original bug (verified).** The sim/renderer/avatar layer always agreed: sitter facing IS `seat.facingAngle`, forward = `(sin θ, cos θ)`, avatar front = local +Z, `rotation.y = facing` (`playerController.ts:208-231`, `characters.ts:798`, `NeighborhoodCanvas.tsx:2561-2562`). Benches were correct by architecture (mesh yaw bound to the same number, `NeighborhoodCanvas.tsx:1243`). The **armchairs bypassed the contract**: nook mesh yaw 0 vs anchor π (sitter faced exactly opposite — into the backrest); copperwheel mesh yaw 0.5 vs anchor ≈1.896 (≈97° off); bakery bentwood authored front +X with ad-hoc 0.15 offset vs anchor π/2; LR-2 NPC occupant facing disagreed with both.

**Fix already committed (`34905d5`, on remote) and independently verified by this investigation:**
- New `src/game/seating.ts`: `seatMeshYaw(facingAngle, forwardAxis: '+z'|'-z'|'+x'|'-x')` — one pure function binding every backed mesh's world yaw to its seat anchor.
- Nook/copperwheel/bakery chair groups + bench loop now derive yaw from the anchor (call sites: `NeighborhoodCanvas.tsx:1243`, `bookNookInterior.ts:510`, `bakeryInterior.ts:646-647`, `copperwheelInterior.ts:733-734`); copperwheel position derives from exported `CW_ARMCHAIR_ORIGIN/FACING`.
- Regression locks: exact sit-facing for all 12 seats; quarter-turn sweeps (270/90/180/108.6° real seats + 0/90/180/270 × 4 axes pure round-trip); 5× sit/stand cycles zero drift; built-rig yaw bindings with front-vector dot > 0.999 (`seating.test.ts`, `seatingOrientation.test.ts`).
- No model-specific rotation patches were introduced; greps confirm zero hardcoded seating yaw remains.

**Residual seating defects (found by adversarial verification — to fix in Phase 6):**

| ID | Defect | Evidence | Severity |
|---|---|---|---|
| C-1 | **Foxglove Rise seated sink**: deck ground y = 0.62 (`worldMap.ts:475-477`) but seated ground Y uses `computeSitGroundY(0.36, 1.0) = 0.03` ignoring terrain → seated player and NPCs render ≈0.59 inside the deck | `playerController.ts:219`, `NeighborhoodCanvas.tsx:2001-2003` | P2 (visual, live) |
| C-2 | Stand-up null fallback: if `resolveSeatStandPos` ever returns null, both callers keep the sitter at seatPos *inside* the collider volume with no recovery | `actions.ts:970`, `playerController.ts:200-205`, `walkability.ts:110-122` | P2 (latent) |
| C-3 | Sorrel Hollow approach margin 0.05 — any collider radius bump re-traps sitters | `worldMap.ts:194` vs `:127` | P2 (fragility) |
| C-4 | Outdoor bench-loop yaw binding has no mesh-level test; backless stools have no contract lock if a backrest is ever added | `NeighborhoodCanvas.tsx:1243`, `cottageInterior.ts:1365-1368` | P2 (test gap) |
| C-5 | Outdoor bench sip gap: seated outdoors only "Stand Up" is offered; `sipBeverageAtTableAction` hard-rejects exterior | `playerController.ts:545-556`, `actions.ts:1052-1054` | P2 |

---

## D. Camera system (Problem D)

**Observable behavior.** No way to rotate the view; zoom is desktop-wheel-only within a narrow band; walking behind buildings hides the player; the world is only legible from one 45° azimuth; on low-FPS devices the whole game feels slow-motion; touch-drag on the canvas triggers unwanted walk.

**Root causes (all in the inline camera code of `NeighborhoodCanvas.tsx`):**

| ID | Defect | Root cause / evidence | Severity |
|---|---|---|---|
| D-1 | **No rotation at all** — zero drag/rotate input exists; the camera is a constant offset `(19.5, 18.2, 19.5)` in every branch | only listeners: pointerdown `:1343`, wheel `:1663-1669`, keys `:1339-1341`; fixed offsets `:511, :2611-2613, :2647-2649`; builders authored against fixed angle (`buildings.ts:1395,1603`) | P1 (feature gap, user-flagged) |
| D-2 | **Buildings obstruct the player**; sole mitigation is a heuristic height-lift that triggers only in one quadrant (`z>8.5 && |x|>8.5`) — covers the cottage door corner only; no raycast/occlusion system exists | `:2620-2622`; raycaster used for picking only `:1350, 1366` | P1 (user-flagged) |
| D-3 | **Zoom inadequate**: clamp 0.72–1.45, desktop wheel only, 5 discrete HUD steps, no pinch, `passive:true` wheel | `:1663-1669`, `App.tsx:1318-1339` | P1 (user-flagged) |
| D-4 | **Greenhouse interior falls through to the exterior camera branch** (far exterior distance in a 6×5.2 room, occlusion lift evaluated on interior coords → always 0, entry snap immediately re-damps away) | interior branch lists cottage/bakery/nook/copperwheel only, `:2602-2607` | P1 |
| D-5 | **Tap-to-walk fires on `pointerdown`** — any touch-drag is an unintended walk; no drag-cancel; also the mechanical blocker for adding drag-rotation | `:1343-1662` (walk commit at 1629–1660) | P1 (mobile) |
| D-6 | **Slow-motion time dilation below 20 FPS**: every long frame is capped (`dt = min(raw, 0.05)`) and there is no catch-up accumulator — world clock, NPCs and player all slow proportionally | `:2199-2201`, `playerController.ts:181` | P1 |
| D-7 | Look-target pops: position is damped but `lookAt` jumps when dialogue opens (midpoint switch `:2641-2645`) and on branch switches; only dialogue-drop-y is smoothed | `:2624-2655` | P2 |
| D-8 | Tap-walk wall-hug loop: stuck-cancel requires speed < 0.22, so sliding along a wall resets the timer; unreachable destination never aborts | `:2431-2443`, `:1620` | P2 |
| D-9 | Dead input: Space/Enter captured into keysDown while playing, never consumed | `:1327-1331` | P2 |
| D-10 | Movement basis hardcodes the 45° iso constants (`0.7071`) — camera rotation would silently break WASD/joystick directionality until re-derived | `:2316-2319` | P1 (prereq for D-1) |
| D-11 | Per-frame allocations in movement/target selection (fresh result objects every tick) | `playerController.ts:210-231, 416-473`; `NC:2143, 2529` | P2 |

**Why the existing implementation behaves this way.** The camera was authored as a set of magic-number branches inside the render effect, each tuned against the fixed angle; there is no camera *state* to speak of (no yaw/pitch/zoom model), so there is nothing to rotate, and occlusion was never modeled.

---

## E. Interior camera positioning and framing (Problem E)

**Observable behavior.** Entering a room snaps the camera; the player can sit against a wall and the framing aims at empty floor; rooms of different sizes get the same distance; the greenhouse interior is framed as if it were the outdoors; rotating/zooming inside is possible only within a narrow band; transitions in/out feel abrupt despite the veil.

**Root causes:**

| ID | Defect | Root cause / evidence | Severity |
|---|---|---|---|
| E-1 | **Entry transition is a hard teleport**: `position.set(...)` on location change (focus = player×0.45, zoom 0.66) — no transition path | `NeighborhoodCanvas.tsx:2377-2395` | P1 |
| E-2 | **No room-size adaptation**: interior framing is one formula — focus compressed ×0.42 toward room center, offset `(19.5,18.2,19.5)×clamp(zoom×0.68, 0.56, 0.92)`, lookAt y fixed 0.85 | `:2602-2618` | P1 |
| E-3 | **Player-at-wall framing failure**: player at (3.0, 2.0) aims camera at (1.26, 0.84) — the look target is a compression of player pos, not a weighted composition; aim never smoothed | same block | P1 |
| E-4 | **Greenhouse omission** (same as D-4) | `:2602-2607` | P1 |
| E-5 | **No room-profile data**: bounds/focal points exist in the game layer (`*_BOUNDS`, `focusX/focusZ` per interactable) but the camera consumes none of them; wall heights exist only as builder literals | Doc 01 §4; `cottage.ts:53-135` etc. | P1 (enabler) |
| E-6 | **Cutaway is baked for one angle**: tall N/W walls + low E/S curbs authored into geometry — correct at 45° azimuth, wrong at any other; blocks E-rotation | builders per Doc 01 §4 | P1 (enabler) |
| E-7 | Exit transition snaps similarly (position.set to exterior framing) | `:2377-2395` | P2 |

**Why the existing implementation behaves this way.** Interiors are origin-centered dioramas whose camera treatment was authored per-angle with inline constants; room data was never surfaced to the camera layer.

---

## F/G. Additional defects found by adversarial audit (Problem F)

### P1 (fix in this overhaul)

| ID | Area | Defect | Evidence |
|---|---|---|---|
| G-1 | Input | **Joystick leaks a stuck movement vector on unmount** — bottom controls unmount on modal open; `VirtualJoystick` has no unmount cleanup, so on modal close the last drag vector instantly re-triggers auto-walk with no finger on screen | `App.tsx:1389-1392`, `VirtualJoystick.tsx:14-59` (reset only in pointer handlers), consumption `NeighborhoodCanvas.tsx:2301-2319` |
| G-2 | Save/load | **Future-schema saves silently downgrade and are then overwritten** — version > current only warns, sanitizer strips unknown fields, autosave persists the stripped v11 over the newer save (permanent data loss on forward-compat) | `migrations.ts:2230-2232`, `storage.ts:70-77`, autosave `App.tsx:1121-1125` |
| G-3 | Interactions | **No runtime range validation on dispatch** — reducers execute at whatever distance the player ended up (masked today by selector checks; one refactor from teleport-interactions; sits are literal teleports) | `App.tsx:326-622`; grep: no `distance2D` in `actions.ts` reducers; pending-target flow `NeighborhoodCanvas.tsx:1615, 2351-2356` |
| G-4 | NPC | **NPCs never separate from the player** — `_otherPositions` is built from other NPCs only; residents walk straight through the player | `simulation.ts:742-749`, `worldMap.ts:517-529` |
| G-5 | Perf | dt-cap slow-motion (same root as D-6) | `:2199-2201` |

### P2 (fix the cheap/critical ones, register the rest)

| ID | Area | Defect | Evidence |
|---|---|---|---|
| G-6 | Fountain | Stale registry anchor (0, 4.1) vs center (0, 1.5) | `worldMap.ts:279` vs `:94` — **fixed in fountain phase** |
| G-7 | NPCs | 1-tick seat double-occupancy window (arrival teleport precedes steal reconciliation) | `simulation.ts:760-771, 692-699` |
| G-8 | NPCs | A* failure returns a direct-line waypoint → NPC beelines into a wall before the watchdog bails | `navigation.ts:304` |
| G-9 | NPCs | Pure `stepSimulation` wrapper mutates caller's `residents` (documented deferred) | `simulation.ts:1055-1104, 399-401` |
| G-10 | Player | Dead sprint clause (`sprintHeld || inputMagnitude >= 0.96 && sprintHeld`) — second subsumed; intended clause lost | `playerController.ts:138` |
| G-11 | Player | Seat range inconsistency: HUD selection 2.0 vs tap raycast 2.35 | `playerController.ts:657` vs `NeighborhoodCanvas.tsx:1515` |
| G-12 | Player | Fountain-wish / stone-skip have no cooldown; unique-id witness memories spam `npcMemories` until daily prune | `actions.ts:1963-2032, 2034-2106` |
| G-13 | Save | Autosave failures swallowed; corruption log says "v7" (actual v11); held item survives sleep | `App.tsx:283, 1117`, `storage.ts:57, 567-634` |
| G-14 | UI | `KeyM` mute bypasses modal gating (inconsistent with every other shortcut) | `App.tsx:1010-1013` |
| G-15 | Perf | `composeEnvironmentState` allocates every frame even when revision unchanged | `environment.ts:253-298` |
| G-16 | Perf | Ambient-sway registries never cleared on remount (leak across mounts) | `ambientSway.ts:42-43` |
| G-17 | Time | No "feeling sleepy" nudge at curfew; world freezes at 9:30 PM for inattentive players | `time.ts:11-14`, `storage.ts:570` |
| G-18 | Camera | Space/Enter dead-captured; look-target pops (see D-7/D-9) | `:1327-1331` |

**Verified non-issues** (audited, correct as-is): two NPCs cannot claim one seat; outdoor seats blocked while NPC sits; nook armchair blocked while Nora occupies; seat-steal reconciliation; pointerdown gated during modals; joystick pointer-capture isolation; perfProbe zero-GC; contactShadow lifecycle; weather determinism; audio autoplay unlock; migration chain v1→v11 with backup.

---

## Architectural implications summary

1. Problems D+E are not "missing features" — they are the absence of a **camera system**. The fix is an extraction (camera into a controller module) plus three new capabilities (rotation with dynamic cutaway, occlusion response, room framing), all consuming data that already exists in the game layer.
2. The seating contract proves this codebase's pattern works: one pure convention + tests + call-site discipline. The camera should follow the same pattern (`RoomCameraProfile` + pure framing math + regression tests).
3. The fountain/furniture work is contained by existing rig/contract boundaries (`FountainRig`, seat contract) — geometry can be replaced without touching the simulation.
4. The G-register P1s are cheap, high-value, and independent; the dt accumulator (G-5/D-6) must land **before** camera occlusion raycasts are added, so the loop never runs probe-heavy code inside a dilation window.
