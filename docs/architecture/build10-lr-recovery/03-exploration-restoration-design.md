# 03 — Exploration Restoration Design (D-01)

**Principle:** restore the original lifecycle wiring, byte-for-byte; change nothing else.

## Restoration

Commit `f46740f` re-adds to `src/game/simulation.ts`:

1. the import `import { discoverExplorationInPlace } from './exploration';` (kept additively next to the LR `expireInvitationsInPlace` import — the original defect was a swap, the fix is an addition), and
2. the step-0 block inside `stepSimulationInPlace`, restored **byte-identically** from `9cde87d` (430 bytes, md5-verified identical by the architecture auditor; position identical: after `if (paused) return;` + array guards + `phase`, before step-1 encounter expiry).

```ts
// 0. Wild Hollows exploration discoveries (Build 10): deterministic, exterior-only,
// pure in-place sideFlag + journal memory grant — same discipline as encounters.
{
  const outside = world.playerLocation === 'exterior';
  const ex = outside ? world.playerPos.x : world.exteriorPlayerPos.x;
  const ez = outside ? world.playerPos.z : world.exteriorPlayerPos.z;
  discoverExplorationInPlace(world, ex, ez);
}
```

## Lifecycle position audit (architecture specialist, doc 08 §1)

`dt clamp` → clock advance → `expireInvitationsInPlace` (LR-only, clock-coupled) → `paused` gate → array guards → `phase` → **step-0 discovery** → step-1 encounter expiry → step-2 resident loop. Verified properties:

- Paused (or `dialogueOpen` with frozen clock) never grants — the block sits after the paused return and discovery is position-driven, not time-driven.
- Discovery reads `playerLocation` / `playerPos` / `exteriorPlayerPos` — no earlier step in the tick writes those; it cannot observe a half-updated world.
- Interior/LR-2 interaction: the `indoorResidentId` skip only gates resident autonomy and encounter formation; during a Nook visit discovery still evaluates against the preserved `exteriorPlayerPos` — 9cde87d semantics, pinned by BD10-03. Geometry: every interior porch/door anchor is >10 m from the nearest zone center (nearest: greenhouse porch → Marigold Lane = 10.5 m vs radius 5.2), so no cross-context grant exists (specialist-measured).
- `discoverExplorationInPlace` is copy-on-write (`sideFlags = {...}`, `memories = [new, ...old]`), idempotent (flag + memory-id guards), pure-in-place for the tick contract, and persists through the real save/load path (`sanitizeSideFlags` preserves arbitrary boolean keys; `computeWorldSaveRevision` hashes sideFlags + memory ids so the grant flips the autosave dirty flag).

## Known preserved behavior (not a regression)

- The original block discards the return value — no toast on discovery. Faithful to 9cde87d; see the deferred register (F-UX-1, journal/toast freshness) in doc 12.
- `dialogueOpen` does not suppress discovery (clock frozen, position check still runs) — 9cde87d behavior.

## Regression protection

`src/game/build10-recovery.test.ts` §1 (BD10-01…09): first-visit grant (sideFlag + journal memory, day/phase stamped), 60-tick idempotency, indoor `exteriorPlayerPos` sourcing, leave/return + independent sites, negative space (spawn/plaza/far-indoor never grant), phase crossing + day rollover + DAY_END clamp, save→load persistence with no re-grant, 2000-tick determinism (stable JSON hash + `computeWorldSaveRevision`), and an interleaved tick+dialogue determinism pin. Mutation-verified: removing the tick call fails 7 of 13 (doc 08 §5).
