# 07 — Simulation State Ownership

**Scope:** who creates state, who may mutate it, which operations are pure, and the correction that restored the pure-path isolation contract (SR-10 / register F-SIM-1 / H-2). Design of record: doc 03 §3. Correction: commit `b99b124`.

## 1. The ownership model (as verified on this baseline)

| Boundary | Owner / contract |
|---|---|
| **Creation** | `createFreshWorldState` (and migration/sanitization on load) are the only sources of a runtime `WorldState`. |
| **Production tick** | `stepSimulationInPlace` (`simulation.ts`) mutates the app-owned world **by design and by contract**; the frame loop owns `worldRef.current` (`NeighborhoodCanvas.tsx` sole call site); React-visible identity changes only in `commitWorld` (`App.tsx`). Intentional in-place writers are confined to `*InPlace` symbols called from the tick engine. |
| **Pure path** | `stepSimulation` (the pure wrapper) has **zero production callers** (grep-verified: every call site is a test). It must return a state whose mutable leaves never alias the input's. |
| **Reducers** | copy-on-write (verified across the reducer surface in the baseline investigation). |
| **Serialization/deserialization** | non-mutating (verified; pinned by the "sanitize + load do not mutate their inputs" test). |
| **Test fixtures** | created per scenario via the real creation functions; never share mutable state across independent runs. |

## 2. The defect (SR-10 / F-SIM-1) and the smallest coherent correction

The pure wrapper's clone literal grew slice-by-slice with `WorldState` fields and never gained `residents`. The one boundary-crossing in-place writer, `updateResidentEmotionInPlace` (`simulation.ts` — `world.residents[id].mood = …`), therefore leaked mood leaves into a caller-retained input world:

- **Reproduction (register measurement reproduced exactly):** real world from `createFreshWorldState`, structuredClone snapshot, pure steps at the production clock rate → first natural leak at pure step **682**; leaked paths `residents.{jun,toby,pip}.mood` (682), `residents.nora.mood` (983) — exactly the register's 4 mood paths.
- **Consequences (all test/tooling-only):** fixtures retained across runs cross-contaminate; `computeWorldSaveRevision` hashes `prog.mood`, so a test-only run flipped a retained fixture's autosave fingerprint. Production is unaffected by design (`stepSimulationInPlace` owns its mutations; no production caller retains an input across the pure path).
- **Correction:** per-resident shallow record clone in the pure wrapper's clone literal — the minimum isolation that closes every leaf path any tick writer can touch. Deep cloning everywhere was explicitly rejected (doc 02 §SR-10): the architecture intends structural sharing on the pure path; only `residents` lacked the clone its writers required.
- **Cost:** ~0.43–0.44 µs/call at the default population (0.9 % of a pure call — reviewer's independent timing probe measured 0.44 µs); **zero** allocations added to the production path (clone confined to the wrapper; `stepSimulationInPlace` untouched).
- **Value-preservation:** fix-emulation pre-validation showed 1,500-tick value-identical trajectories; trajectories before/after are value-identical (700-step comparison recorded in the commit).

## 3. Verification

- **Purity regression test** (`simulation.test.ts` — "pure stepSimulation never leaks resident mutations into the retained input (SR-10 / F-SIM-1)"): snapshot the input world, run pure steps past the historical leak point, assert the input is untouched.
- **Mutation evidence:** removing the clone literal makes the purity test fail at the same boundary (re-run in this initiative: 6 pass / 1 fail with the mutation applied; green after restore).
- **Full suite:** 459/459 (including the discrete-encounter gossip test that asserts `stepSimulation` inputs are not mutated).
- **Determinism:** untouched by design — the correction adds no arithmetic or ordering changes to the tick graph (doc 03 §4 contract holds; harness replay twins byte-identical).

## 4. Why no other isolation was added

The adversarial investigations probed every boundary the prompt names (fixture creation, simulation entry, tick execution, reducer execution, save/load, browser setup):

- Save/load: non-mutating already (pinned).
- Reducers: copy-on-write verified (7 probes clean in the baseline investigation).
- Production tick: intentionally in-place — adding clones there would be the "unnecessary defensive cloning" the mandate forbids, and would tax every frame.
- The remaining latent shared-slice inventory (two "immutable" chains sharing one base's `residents` record) is rendered harmless by the wrapper clone: any derived state now isolates the leaves a writer can cross. The purity regression test enforces the boundary so future tick writers cannot reopen the class silently.
